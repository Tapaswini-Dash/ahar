import { useEffect, useMemo, useRef, useState } from "react";
import { listMealsForDay } from "../api/mealLogsApi";
import { claimDailyGoal, getGamification } from "../api/gamificationApi";

function localDateKey(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getLastSevenDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function sumMeals(meals) {
  return meals.reduce((totals, meal) => ({
    calories: totals.calories + Number(meal.calories || 0),
    protein: totals.protein + Number(meal.protein_g || 0),
    carbs: totals.carbs + Number(meal.carbs_g || 0),
    fat: totals.fat + Number(meal.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function ProgressBar({ value, target, tone = "green" }) {
  const percent = target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <div className={`nutrition-progress nutrition-progress-${tone}`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function MealRows({ meals, onAnalyze, onAskMeal }) {
  if (!meals.length) {
    return (
      <div className="dashboard-empty">
        <span className="dashboard-empty-icon" aria-hidden="true">＋</span>
        <strong>No meals logged yet</strong>
        <p>Add a meal photo and Ahar will estimate the nutrition for you.</p>
        <button className="dashboard-text-button" type="button" onClick={onAnalyze}>Analyze your first meal <span aria-hidden="true">→</span></button>
      </div>
    );
  }

  return (
    <ul className="meal-list">
      {meals.map((meal) => (
        <li className="meal-row" key={meal.id}>
          <span className={`meal-type-icon meal-type-${meal.meal_type}`} aria-hidden="true">
            {meal.meal_type === "breakfast" ? "☼" : meal.meal_type === "lunch" ? "◉" : meal.meal_type === "dinner" ? "◐" : "◇"}
          </span>
          <span className="meal-row-name"><strong>{meal.food_name}</strong><small>{meal.meal_type} · {new Date(meal.logged_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
          <span className="meal-row-calories"><strong>{formatNumber(meal.calories)}</strong><small>kcal</small></span>
          {onAskMeal && <button className="dashboard-text-button" type="button" onClick={() => onAskMeal(meal)}>Ask about meal</button>}
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage({ token, user, profile, onAnalyze, onHistory, onAskMeal }) {
  const [weekRows, setWeekRows] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState(null);
  const goalClaimedFor = useRef("");
  const days = useMemo(getLastSevenDays, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all(days.map((day) => listMealsForDay(localDateKey(day), token, day)))
      .then((dailyMeals) => {
        if (!cancelled) setWeekRows(days.map((day, index) => ({ date: day, meals: dailyMeals[index] })));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load your food diary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days, token]);

  useEffect(() => {
    let cancelled = false;
    getGamification(token)
      .then((data) => { if (!cancelled) setProgress(data); })
      .catch((requestError) => { if (!cancelled) setProgress((current) => current || { loadError: requestError.message }); });
    return () => { cancelled = true; };
  }, [token]);

  const todayKey = localDateKey();
  const todayMeals = weekRows.find((row) => localDateKey(row.date) === todayKey)?.meals || [];
  const totals = sumMeals(todayMeals);
  const targets = {
    calories: profile.daily_calorie_target,
    protein: profile.daily_protein_target_g,
    carbs: profile.daily_carbs_target_g,
    fat: profile.daily_fat_target_g,
  };
  const calorieProgress = targets.calories ? Math.min(100, (totals.calories / targets.calories) * 100) : 0;
  const remainingCalories = targets.calories ? Math.max(0, targets.calories - totals.calories) : null;
  const weeklyCalories = weekRows.reduce((sum, row) => sum + sumMeals(row.meals).calories, 0);
  const weeklyTarget = targets.calories ? targets.calories * 7 : null;
  const weeklyRemaining = weeklyTarget === null ? null : Math.max(0, weeklyTarget - weeklyCalories);
  const todayComplete = Boolean(targets.calories && totals.calories >= targets.calories);
  useEffect(() => {
    if (loading || !todayComplete || goalClaimedFor.current === todayKey) return;
    goalClaimedFor.current = todayKey;
    claimDailyGoal(todayKey, token).then((result) => {
      if (result.xp !== undefined) setProgress((current) => ({ ...(current || {}), ...result }));
      if (result.awarded) setCelebration(result);
    }).catch(() => {});
  }, [loading, todayComplete, todayKey, token]);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const yesterdayRow = weekRows.find((row) => localDateKey(row.date) === yesterdayKey);
  const hadRecentMeals = weekRows.slice(0, -2).some((row) => row.meals.length > 0);
  const missedYesterday = !loading && hadRecentMeals && yesterdayRow && yesterdayRow.meals.length === 0;
  let visibleStreak = 0;
  let streakIndex = todayMeals.length ? weekRows.length - 1 : weekRows.length - 2;
  for (; streakIndex >= 0 && weekRows[streakIndex]?.meals.length; streakIndex -= 1) visibleStreak += 1;
  if (progress?.current_streak !== undefined) visibleStreak = Math.max(visibleStreak, progress.current_streak);
  const chartMax = Math.max(
    1,
    targets.calories || 0,
    ...weekRows.map((row) => sumMeals(row.meals).calories),
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <div className="dashboard-primary-column">
          <header className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <p className="dashboard-hero-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1>Know what’s<br />on your plate<span aria-hidden="true">.</span></h1>
              <p>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.full_name?.split(" ")[0] || "there"}. Get a clearer picture of today’s nutrition.</p>
              <button className="dashboard-hero-button" type="button" onClick={onAnalyze}>Analyze a meal <span aria-hidden="true">→</span></button>
            </div>
            <div className="dashboard-hero-art" aria-hidden="true">
              <div className="hero-glow" /><div className="hero-plate"><span>🥗</span></div>
              <span className="hero-food-chip hero-chip-one">Protein</span><span className="hero-food-chip hero-chip-two">Fresh today</span>
              <span className="hero-orbit hero-orbit-one" /><span className="hero-orbit hero-orbit-two" />
            </div>
          </header>

          {error && <div className="dashboard-error" role="alert">{error} <button type="button" onClick={() => window.location.reload()}>Try again</button></div>}
          {missedYesterday && <div className="dashboard-reminder" role="status"><strong>Missed yesterday?</strong><span>Add a late entry, or keep logging for today.</span><button type="button" className="dashboard-text-button" onClick={() => onAnalyze(yesterdayKey)}>Log for yesterday</button><button type="button" className="dashboard-text-button" onClick={() => onAnalyze()}>Continue with today</button></div>}

          <section className="dashboard-lower-grid">
            <article className="dashboard-card meals-card">
              <div className="section-heading"><div><p className="card-eyebrow">Your day</p><h2>Today’s meals</h2></div><button className="dashboard-text-button" type="button" onClick={onHistory}>View diary <span aria-hidden="true">→</span></button></div>
              {loading ? <div className="dashboard-loading"><span />Loading today’s meals…</div> : <MealRows meals={todayMeals} onAnalyze={onAnalyze} onAskMeal={onAskMeal} />}
            </article>

            <article className="dashboard-card week-card">
              <div className="week-card-stack" aria-hidden="true">
                <span className="stack-layer stack-layer-3" />
                <span className="stack-layer stack-layer-2" />
                <span className="stack-layer stack-layer-1">📊</span>
              </div>
              <div className="section-heading">
                <div><p className="card-eyebrow">Last 7 days</p><h2>Calories logged</h2></div>
                <span className="week-unit">kcal</span>
              </div>
              <div className="weekly-goal-summary">
                <span>{profile.goal?.replaceAll("_", " ") || "Your goal"} · weekly target</span>
                <strong>{weeklyTarget === null ? "Set a calorie goal in your profile" : `${formatNumber(weeklyCalories)} / ${formatNumber(weeklyTarget)} kcal`}</strong>
                {weeklyRemaining !== null && <small>{formatNumber(weeklyRemaining)} kcal remaining this week</small>}
              </div>
              {loading ? <div className="dashboard-loading"><span />Loading your week…</div> : (
                <div className="week-chart" role="img" aria-label="Calories logged for each of the last seven days">
                  {weekRows.map((row) => {
                    const dayCalories = sumMeals(row.meals).calories;
                    return (
                      <div className="week-day" key={localDateKey(row.date)} title={`${row.date.toLocaleDateString()}: ${formatNumber(dayCalories)} kcal`}>
                        <div className="week-bar-track"><span style={{ height: `${dayCalories ? Math.max(7, (dayCalories / chartMax) * 100) : 4}%` }} /></div>
                        <small>{row.date.toLocaleDateString(undefined, { weekday: "narrow" })}</small>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="chart-caption">Based on meals saved in your diary.</p>
            </article>
          </section>
          <p className="dashboard-disclaimer">Nutrition and calorie values are estimates. Use them as a guide, not medical advice.</p>
        </div>

        <aside className="dashboard-right-column" aria-label="Nutrition summary">
          <article className="dashboard-card calories-card">
            <div className="card-title-row"><div><p className="card-eyebrow">Daily energy</p><h2>Calories</h2></div><span className="card-icon calories-icon" aria-hidden="true">✦</span></div>
            <div className="calories-content">
              <div className="calorie-ring" style={{ "--calorie-progress": `${calorieProgress}%` }}><div><strong>{formatNumber(totals.calories)}</strong><span>kcal eaten</span></div></div>
              <div className="calorie-details">
                <p><span>Daily target</span><strong>{targets.calories ? `${formatNumber(targets.calories)} kcal` : "Not set"}</strong></p>
                <p><span>Remaining</span><strong>{remainingCalories === null ? "—" : `${formatNumber(remainingCalories)} kcal`}</strong></p>
                <ProgressBar value={totals.calories} target={targets.calories} />
                <small>{targets.calories ? `${Math.round(calorieProgress)}% of estimated target` : "Your profile does not have an energy target."}</small>
              </div>
            </div>
          </article>

          <article className="dashboard-card macros-card">
            <div className="card-title-row"><div><p className="card-eyebrow">Nutrients</p><h2>Daily macros</h2></div><span className="card-icon macro-icon" aria-hidden="true">◌</span></div>
            {[
              ["Protein", totals.protein, targets.protein, "blue"],
              ["Carbs", totals.carbs, targets.carbs, "orange"],
              ["Fat", totals.fat, targets.fat, "purple"],
            ].map(([label, value, target, tone]) => (
              <div className="macro-row" key={label}>
                <div><span>{label}</span><strong>{formatNumber(value, 1)} <small>g</small></strong></div>
                <ProgressBar value={value} target={target} tone={tone} />
                <small className="macro-target">{target ? `of ${formatNumber(target)} g` : "Target unavailable"}</small>
              </div>
            ))}
          </article>

          <article className="dashboard-card streak-card">
            <p className="card-eyebrow">Your streak</p>
            <div className="streak-number"><span aria-hidden="true">🔥</span>{visibleStreak}<small> day streak</small></div>
            <div className="level-badge">Lvl {progress?.level ?? 1}</div>
            <ProgressBar value={progress?.xp_into_level ?? 0} target={progress?.xp_for_next_level || 1} tone="gold" />
            <small className="macro-target">{progress?.xp !== undefined ? `${progress.xp_into_level}/${progress.xp_for_next_level} XP to next level` : progress?.loadError || "Loading rewards…"}</small>
            <div className="streak-week-dots" aria-label={`${visibleStreak} consecutive logged days`}>{Array.from({ length: 7 }, (_, index) => <span key={index} className={index < visibleStreak % 7 || visibleStreak >= 7 ? "is-filled" : ""} />)}</div>
            <p>{visibleStreak ? "Keep it going — log a meal today!" : "Log a meal to start your streak."}</p>
          </article>
        </aside>
      </div>
      {celebration && <div className="goal-celebration-backdrop" role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title"><article className="goal-celebration"><span aria-hidden="true">🎉</span><p className="card-eyebrow">Daily goal complete</p><h2 id="goal-celebration-title">You reached your calorie goal!</h2><p>You earned <strong className="xp-earned">+{celebration.xp_awarded} XP</strong>. Your level progress has been updated.</p><button className="dashboard-primary-button" type="button" onClick={() => setCelebration(null)}>Keep going</button></article></div>}
    </div>
  );
}

export function MealHistoryPage({ token, onAnalyze, onAskMeal }) {
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listMealsForDay(selectedDate, token, new Date(`${selectedDate}T12:00:00`))
      .then((result) => { if (!cancelled) setMeals(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate, token]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading-row">
        <div><p className="dashboard-overline">Your food diary</p><h1>Meal history</h1><p className="dashboard-subtitle">Review the meals you’ve saved by day.</p></div>
        <button className="dashboard-primary-button" type="button" onClick={onAnalyze}><span aria-hidden="true">＋</span> Analyze a meal</button>
      </header>
      <section className="dashboard-card history-card">
        <label className="history-date-label">Choose a date <input type="date" value={selectedDate} max={localDateKey()} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        {error && <p className="dashboard-error" role="alert">{error}</p>}
        {loading ? <div className="dashboard-loading"><span />Loading diary…</div> : meals.length ? <MealRows meals={meals} onAnalyze={onAnalyze} onAskMeal={onAskMeal} /> : <div className="dashboard-empty"><strong>No meals for this day</strong><p>When you save a meal, it will show up here.</p></div>}
        {!loading && meals.length > 0 && <div className="history-total"><span>Day total</span><strong>{formatNumber(sumMeals(meals).calories)} kcal</strong></div>}
      </section>
    </div>
  );
}
