import { useEffect, useMemo, useRef, useState } from "react";
import { listMealsForDay, moveMealToDate } from "../api/mealLogsApi";
import { claimDailyGoal, getGamification } from "../api/gamificationApi";
import { getDayStatus, setFastingDay, getDayStatusRange } from "../api/dayStatusApi";
import MiniCalendar from "../components/diary/MiniCalender";

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
  return meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + Number(meal.calories || 0),
      protein: totals.protein + Number(meal.protein_g || 0),
      carbs: totals.carbs + Number(meal.carbs_g || 0),
      fat: totals.fat + Number(meal.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function ProgressBar({ value, target, tone = "green" }) {
  const percent = target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <div className={`nutrition-progress nutrition-progress-${tone}`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function MealRows({
  meals,
  onAnalyze,
  onAskMeal,
  onMoveMeal,
  moveDates = {},
  onMoveDateChange,
}) {
if (!meals.length) {
  return (
    <div className="dashboard-empty">
      <button
        type="button"
        className="dashboard-empty-icon"
        onClick={() => onAnalyze?.(undefined)}
        aria-label="Analyze your first meal"
      >
        ＋
      </button>
      <strong>No meals logged yet</strong>
      <p>Add a meal photo and Ahar will estimate the nutrition for you.</p>
      <button
        className="dashboard-text-button"
        type="button"
        onClick={() => onAnalyze?.(undefined)}
      >
        Analyze your first meal <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

  return (
    <ul className="meal-list">
      {meals.map((meal) => (
        <li className="meal-row" key={meal.id}>
          <span
            className={`meal-type-icon meal-type-${meal.meal_type}`}
            aria-hidden="true"
          >
            {meal.meal_type === "breakfast"
              ? "☼"
              : meal.meal_type === "lunch"
              ? "◉"
              : meal.meal_type === "dinner"
              ? "◐"
              : "◇"}
          </span>
          <span className="meal-row-name">
            <strong>{meal.food_name}</strong>
            <small>
              {meal.meal_type} ·{" "}
              {new Date(meal.logged_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </small>
          </span>
          <span className="meal-row-calories">
            <strong>{formatNumber(meal.calories)}</strong>
            <small>kcal</small>
          </span>
          {onAskMeal && (
            <button
              className="dashboard-text-button"
              type="button"
              onClick={() => onAskMeal(meal)}
            >
              Ask about meal
            </button>
          )}
          {onMoveMeal && (
            <span className="meal-move-controls">
              <input
                aria-label={`New date for ${meal.food_name}`}
                type="date"
                value={moveDates[meal.id] || ""}
                max={localDateKey()}
                onChange={(event) =>
                  onMoveDateChange(meal.id, event.target.value)
                }
              />
              <button
                className="dashboard-text-button"
                type="button"
                disabled={!moveDates[meal.id]}
                onClick={() => onMoveMeal(meal.id, moveDates[meal.id])}
              >
                Move to this date
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage({
  token,
  user,
  profile,
  onAnalyze,
  onHistory,
  onAskMeal,
}) {
  const [weekRows, setWeekRows] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState(null);
  const goalClaimedFor = useRef("");
  const days = useMemo(getLastSevenDays, []);
  const [todayFasting, setTodayFasting] = useState(false);

useEffect(() => {
  if (!token) return;
  let cancelled = false;
  getDayStatus(localDateKey(), token)
    .then((data) => {
      if (!cancelled) setTodayFasting(Boolean(data?.fasting_day));
    })
    .catch(() => {});
  return () => { cancelled = true; };
}, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all(days.map((day) => listMealsForDay(localDateKey(day), token, day)))
      .then((dailyMeals) => {
        if (!cancelled)
          setWeekRows(
            days.map((day, index) => ({ date: day, meals: dailyMeals[index] }))
          );
      })
      .catch((requestError) => {
        if (!cancelled)
          setError(requestError.message || "Could not load your food diary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, token]);

  useEffect(() => {
    let cancelled = false;
    getGamification(token)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch((requestError) => {
        if (!cancelled)
          setProgress(
            (current) => current || { loadError: requestError.message }
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const todayKey = localDateKey();
  const todayMeals =
    weekRows.find((row) => localDateKey(row.date) === todayKey)?.meals || [];
  const totals = sumMeals(todayMeals);
  const targets = {
    calories: profile.daily_calorie_target,
    protein: profile.daily_protein_target_g,
    carbs: profile.daily_carbs_target_g,
    fat: profile.daily_fat_target_g,
  };
  const calorieProgress = targets.calories
    ? Math.min(100, (totals.calories / targets.calories) * 100)
    : 0;
  const remainingCalories = targets.calories
    ? Math.max(0, targets.calories - totals.calories)
    : null;
  const weeklyCalories = weekRows.reduce(
    (sum, row) => sum + sumMeals(row.meals).calories,
    0
  );
  const weeklyTarget = targets.calories ? targets.calories * 7 : null;
  const weeklyRemaining =
    weeklyTarget === null ? null : Math.max(0, weeklyTarget - weeklyCalories);
  const todayComplete = Boolean(
    targets.calories && totals.calories >= targets.calories
  );

  useEffect(() => {
    if (loading || !todayComplete || goalClaimedFor.current === todayKey) return;
    goalClaimedFor.current = todayKey;
    claimDailyGoal(todayKey, token)
      .then((result) => {
        if (result.xp !== undefined)
          setProgress((current) => ({ ...(current || {}), ...result }));
        if (result.awarded) setCelebration(result);
      })
      .catch(() => {});
  }, [loading, todayComplete, todayKey, token]);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const yesterdayRow = weekRows.find(
    (row) => localDateKey(row.date) === yesterdayKey
  );
  const hadRecentMeals = weekRows
    .slice(0, -2)
    .some((row) => row.meals.length > 0);
  const missedYesterday =
    !loading && hadRecentMeals && yesterdayRow && yesterdayRow.meals.length === 0;

  let visibleStreak = 0;
  let streakIndex = todayMeals.length
    ? weekRows.length - 1
    : weekRows.length - 2;
  for (
    ;
    streakIndex >= 0 && weekRows[streakIndex]?.meals.length;
    streakIndex -= 1
  )
    visibleStreak += 1;
  if (progress?.current_streak !== undefined)
    visibleStreak = Math.max(visibleStreak, progress.current_streak);

  const chartMax = Math.max(
    1,
    targets.calories || 0,
    ...weekRows.map((row) => sumMeals(row.meals).calories)
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        {/* LEFT: hero + bottom row */}
        <div className="dashboard-primary-column">
          <header className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <p className="dashboard-hero-eyebrow">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>
                Know what’s
                <br />
                on your plate<span aria-hidden="true">.</span>
              </h1>
              <p>
                Good{" "}
                {new Date().getHours() < 12
                  ? "morning"
                  : new Date().getHours() < 18
                  ? "afternoon"
                  : "evening"}
                , {user?.full_name?.split(" ")[0] || "there"}. Get a clearer
                picture of today’s nutrition.
              </p>
              <button
                className="dashboard-hero-button"
                type="button"
                onClick={() => onAnalyze?.()}
              >
                Analyze a meal <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="dashboard-hero-art" aria-hidden="true">
              <div className="hero-glow" />
              <div className="hero-plate">
                <span>🥗</span>
              </div>
              <span className="hero-food-chip hero-chip-one">Protein</span>
              <span className="hero-food-chip hero-chip-two">Fresh today</span>
              <span className="hero-orbit hero-orbit-one" />
              <span className="hero-orbit hero-orbit-two" />
            </div>
          </header>

          {error && (
            <div className="dashboard-error" role="alert">
              {error}{" "}
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          )}



          {/* BOTTOM ROW — two cards side by side */}
          <div className="dashboard-bottom-row">
            <article className="dashboard-card meals-card">
              <div className="section-heading">
                {todayFasting && (
  <p className="dashboard-fasting-badge">
    <span aria-hidden="true">🌙</span> Fasting today
  </p>
)}
                <div>
                  <p className="card-eyebrow">Your day</p>
                  <h2>Today’s meals</h2>
                </div>
                <button
                  className="dashboard-text-button"
                  type="button"
                  onClick={onHistory}
                >
                  View diary <span aria-hidden="true">→</span>
                </button>
              </div>
              {loading ? (
                <div className="dashboard-loading">
                  <span />
                  Loading today’s meals…
                </div>
              ) : (
                <MealRows
                  meals={todayMeals}
                  onAnalyze={onAnalyze}
                  onAskMeal={onAskMeal}
                />
              )}
            </article>

            <article className="dashboard-card week-card">
              <div className="section-heading">
                <div>
                  <p className="card-eyebrow">Last 7 days</p>
                  <h2>Calories logged</h2>
                </div>
                <span className="week-unit">kcal</span>
              </div>
              <div className="weekly-goal-summary">
                <span>
                  {profile.goal?.replaceAll("_", " ") || "Your goal"} · weekly
                  target
                </span>
                <strong>
                  {weeklyTarget === null
                    ? "Set a calorie goal in your profile"
                    : `${formatNumber(weeklyCalories)} / ${formatNumber(
                        weeklyTarget
                      )} kcal`}
                </strong>
                {weeklyRemaining !== null && (
                  <small>
                    {formatNumber(weeklyRemaining)} kcal remaining this week
                  </small>
                )}
              </div>
              {loading ? (
                <div className="dashboard-loading">
                  <span />
                  Loading your week…
                </div>
              ) : (
                <div
                  className="week-chart"
                  role="img"
                  aria-label="Calories logged for each of the last seven days"
                >
                  {weekRows.map((row) => {
                    const dayCalories = sumMeals(row.meals).calories;
                    return (
                      <div
                        className="week-day"
                        key={localDateKey(row.date)}
                        title={`${row.date.toLocaleDateString()}: ${formatNumber(
                          dayCalories
                        )} kcal`}
                      >
                        <div className="week-bar-track">
                          <span
                            style={{
                              height: `${
                                dayCalories
                                  ? Math.max(
                                      7,
                                      (dayCalories / chartMax) * 100
                                    )
                                  : 4
                              }%`,
                            }}
                          />
                        </div>
                        <small>
                          {row.date.toLocaleDateString(undefined, {
                            weekday: "narrow",
                          })}
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="chart-caption">
                Based on meals saved in your diary.
              </p>
            </article>
          </div>

          <p className="dashboard-disclaimer">
            Nutrition and calorie values are estimates. Use them as a guide,
            not medical advice.
          </p>
        </div>

        {/* RIGHT: calories + macros + streak */}
        <aside className="dashboard-right-column" aria-label="Nutrition summary">
          <article className="dashboard-card calories-card">
            <div className="card-title-row">
              <div>
                <p className="card-eyebrow">Daily energy</p>
                <h2>Calories</h2>
              </div>
              <span className="card-icon calories-icon" aria-hidden="true">
                ✦
              </span>
            </div>
            <div className="calories-content">
              <div
                className="calorie-ring"
                style={{ "--calorie-progress": `${calorieProgress}%` }}
              >
                <div>
                  <strong>{formatNumber(totals.calories)}</strong>
                  <span>kcal eaten</span>
                </div>
              </div>
              <div className="calorie-details">
                <p>
                  <span>Daily target</span>
                  <strong>
                    {targets.calories
                      ? `${formatNumber(targets.calories)} kcal`
                      : "Not set"}
                  </strong>
                </p>
                <p>
                  <span>Remaining</span>
                  <strong>
                    {remainingCalories === null
                      ? "—"
                      : `${formatNumber(remainingCalories)} kcal`}
                  </strong>
                </p>
                <ProgressBar value={totals.calories} target={targets.calories} />
                <small>
                  {targets.calories
                    ? `${Math.round(calorieProgress)}% of estimated target`
                    : "Your profile does not have an energy target."}
                </small>
              </div>
            </div>
          </article>

          <article className="dashboard-card macros-card">
            <div className="card-title-row">
              <div>
                <p className="card-eyebrow">Nutrients</p>
                <h2>Daily macros</h2>
              </div>
              <span className="card-icon macro-icon" aria-hidden="true">
                ◌
              </span>
            </div>
            {[
              ["Protein", totals.protein, targets.protein, "blue"],
              ["Carbs", totals.carbs, targets.carbs, "orange"],
              ["Fat", totals.fat, targets.fat, "purple"],
            ].map(([label, value, target, tone]) => (
              <div className="macro-row" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {formatNumber(value, 1)} <small>g</small>
                  </strong>
                </div>
                <ProgressBar value={value} target={target} tone={tone} />
                <small className="macro-target">
                  {target ? `of ${formatNumber(target)} g` : "Target unavailable"}
                </small>
              </div>
            ))}
          </article>

          <article className="dashboard-card streak-card">
            <p className="card-eyebrow">Your streak</p>
            <div className="streak-number">
              <span aria-hidden="true">🔥</span>
              {visibleStreak}
              <small> day streak</small>
            </div>
            <div className="level-badge">Lvl {progress?.level ?? 1}</div>
            <ProgressBar
              value={progress?.xp_into_level ?? 0}
              target={progress?.xp_for_next_level || 1}
              tone="gold"
            />
            <small className="macro-target">
              {progress?.xp !== undefined
                ? `${progress.xp_into_level}/${progress.xp_for_next_level} XP to next level`
                : progress?.loadError || "Loading rewards…"}
            </small>
            <div
              className="streak-week-dots"
              aria-label={`${visibleStreak} consecutive logged days`}
            >
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  key={index}
                  className={
                    index < visibleStreak % 7 || visibleStreak >= 7
                      ? "is-filled"
                      : ""
                  }
                />
              ))}
            </div>
            <p>
              {visibleStreak
                ? "Keep it going — log a meal today!"
                : "Log a meal to start your streak."}
            </p>
          </article>
        </aside>
      </div>

      {celebration && (
        <div
          className="goal-celebration-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <article className="goal-celebration">
            <span aria-hidden="true">🎉</span>
            <p className="card-eyebrow">Daily goal complete</p>
            <h2>You reached your calorie goal!</h2>
            <p>
              You earned{" "}
              <strong className="xp-earned">+{celebration.xp_awarded} XP</strong>
              . Your level progress has been updated.
            </p>
            <button
              className="dashboard-primary-button"
              type="button"
              onClick={() => setCelebration(null)}
            >
              Keep going
            </button>
          </article>
        </div>
      )}
    </div>
  );
}

export function MealHistoryPage({ token, profile, onAnalyze, onAskMeal }) {

  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moveDates, setMoveDates] = useState({});

  // Status map for the calendar: { "YYYY-MM-DD": { fasting, hasMeals } }
  const [statuses, setStatuses] = useState({});
  const [statusLoading, setStatusLoading] = useState(false);

  // ---- Load selected day's meals ----
  // Which month are we looking at? Used to decide when to refetch the
// whole month's statuses vs just the one selected day.
  // ---- Load selected day's meals ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listMealsForDay(selectedDate, token, new Date(`${selectedDate}T12:00:00`))
      .then((result) => {
        if (!cancelled) setMeals(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load this day's meals.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, token]);
const monthKeyOf = (dateStr) => dateStr.slice(0, 7);

// Refs to avoid clobbering optimistic updates
const lastMonthRef = useRef("");
const statusesRef = useRef({});
useEffect(() => { statusesRef.current = statuses; }, [statuses]);

// Fetch statuses for the visible month (±1 month)
useEffect(() => {
  if (!token) return;
  const thisMonth = monthKeyOf(selectedDate);
  if (lastMonthRef.current === thisMonth) return;
  lastMonthRef.current = thisMonth;

  let cancelled = false;
  setStatusLoading(true);

  const base = new Date(`${selectedDate}T12:00:00`);
  const start = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 2, 0);

  const startKey = localDateKey(start);
  const endKey = localDateKey(end);

  getDayStatusRange(startKey, endKey, token)
    .then((rows) => {
      if (cancelled) return;
      setStatuses((current) => {
        const map = { ...current };
        rows.forEach(({ log_date, fasting_day, has_meals }) => {
          if (!map[log_date]?.optimistic) {
            map[log_date] = {
              fasting: Boolean(fasting_day),
              hasMeals: Boolean(has_meals),
            };
          }
        });
        return map;
      });
    })
    .catch(() => {})
    .finally(() => {
      if (!cancelled) setStatusLoading(false);
    });

  return () => { cancelled = true; };
}, [token, selectedDate]);

async function toggleFasting(dateKey, value) {
  // Optimistic update, marked as optimistic so background refetches don't clobber it
  setStatuses((cur) => ({
    ...cur,
    [dateKey]: { ...(cur[dateKey] || {}), fasting: value, optimistic: true },
  }));
  try {
    await setFastingDay(dateKey, value, token);
    // On success, drop the optimistic flag but keep the value
    setStatuses((cur) => ({
      ...cur,
      [dateKey]: { ...(cur[dateKey] || {}), fasting: value, optimistic: false },
    }));
  } catch {
    // Revert on failure
    setStatuses((cur) => ({
      ...cur,
      [dateKey]: { ...(cur[dateKey] || {}), fasting: !value, optimistic: false },
    }));
  }
}

  async function moveMeal(mealId, date) {
    setError("");
    try {
      await moveMealToDate(mealId, date, token);
      setSelectedDate(date);
      setMoveDates((cur) => ({ ...cur, [mealId]: date }));
      if (date === selectedDate) {
        setMeals(await listMealsForDay(date, token, new Date(`${date}T12:00:00`)));
      }
    } catch (err) {
      setError(err.message || "Could not change the meal date.");
    }
  }

  const groupedMeals = ["breakfast", "lunch", "dinner", "snack"]
    .map((type) => ({
      type,
      meals: meals.filter((m) => m.meal_type === type),
      total: meals
        .filter((m) => m.meal_type === type)
        .reduce((sum, m) => sum + Number(m.calories || 0), 0),
    }))
    .filter((g) => g.meals.length > 0);

  const dayTotals = sumMeals(meals);
  const isToday = selectedDate === localDateKey();
  const isFuture = selectedDate > localDateKey();
  const fastingDay = Boolean(statuses[selectedDate]?.fasting);
  const dayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const targets = {
    calories: profile?.daily_calorie_target || 0,
    protein: profile?.daily_protein_target_g || 0,
    carbs: profile?.daily_carbs_target_g || 0,
    fat: profile?.daily_fat_target_g || 0,
  };

  const calorieProgress = targets.calories
    ? Math.min(100, (dayTotals.calories / targets.calories) * 100)
    : 0;
  const remaining = targets.calories - dayTotals.calories;
  const goalMet = targets.calories > 0 && dayTotals.calories >= targets.calories;

  function shiftDate(days) {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const key = localDateKey(d);
    if (key > localDateKey()) return;
    setSelectedDate(key);
  }

  return (
    <div className="diary-page">
      <header className="diary-header">
        <div>
          <p className="diary-eyebrow">Food diary</p>
          <h1 className="diary-title">Your saved meals</h1>
        </div>
        <button
          className="diary-analyze-button"
          type="button"
          onClick={() => onAnalyze?.()}
        >
          <span aria-hidden="true">＋</span> Analyze a meal
        </button>
      </header>

      <div className="diary-grid">
        <div className="diary-main">
          <div className="diary-date-card">
            <div className="diary-date-nav">
              <button
                type="button"
                className="diary-date-arrow"
                aria-label="Previous day"
                onClick={() => shiftDate(-1)}
              >
                ←
              </button>
              <div className="diary-date-display">
                <p className="diary-date-eyebrow">
                  {isToday ? "Today" : fastingDay ? "Fasting day" : "Selected"}
                </p>
                <p className="diary-date-value">{dayLabel}</p>
                <label className="diary-date-picker">
                  <input
                    type="date"
                    value={selectedDate}
                    max={localDateKey()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <span aria-hidden="true">📅</span>
                </label>
              </div>
              <button
                type="button"
                className="diary-date-arrow"
                aria-label="Next day"
                disabled={isToday}
                onClick={() => shiftDate(1)}
              >
                →
              </button>
            </div>
            {!isToday && (
              <button
                type="button"
                className="diary-today-button"
                onClick={() => setSelectedDate(localDateKey())}
              >
                Jump to today
              </button>
            )}
          </div>

          {error && <p className="dashboard-error" role="alert">{error}</p>}

          {loading ? (
            <div className="dashboard-loading">
              <span />
              Loading diary…
            </div>
          ) : fastingDay ? (
            <div className="diary-empty is-fasting">
              <span className="diary-empty-icon is-moon" aria-hidden="true">🌙</span>
              <strong>Fasting day</strong>
              <p>Intentional rest — nothing to log.</p>
              <button
                type="button"
                className="dashboard-text-button"
                onClick={() => toggleFasting(selectedDate, false)}
              >
                Unmark fasting
              </button>
            </div>
          ) : meals.length === 0 ? (
            <div className="diary-empty">
              <span className="diary-empty-icon" aria-hidden="true">
                {isFuture ? "📅" : "🍽"}
              </span>
              <strong>{isFuture ? "Nothing logged yet" : "No meals logged this day"}</strong>
              <p>
                {isFuture
                  ? "Check back after you eat, or log a meal in advance."
                  : "Add a photo and Ahar will estimate the nutrition for you."}
              </p>
              <div className="diary-empty-actions">
  <button
    type="button"
    className="diary-action-button primary"
    onClick={() => onAnalyze?.(selectedDate)}
  >
    <span aria-hidden="true">＋</span> Analyze a meal
  </button>
</div>
            </div>
          ) : (
            <div className="diary-groups">
{groupedMeals.map((group) => (
  <section className={`diary-group meal-group-${group.type}`} key={group.type}>
                  <header className="diary-group-head">
                    <span className={`meal-type-icon meal-type-${group.type}`} aria-hidden="true">
                      {group.type === "breakfast"
                        ? "☼"
                        : group.type === "lunch"
                        ? "◉"
                        : group.type === "dinner"
                        ? "◐"
                        : "◇"}
                    </span>
                    <div className="diary-group-title">
                      <strong>{group.type}</strong>
                      <small>
                        {group.meals.length} item{group.meals.length === 1 ? "" : "s"}
                      </small>
                    </div>
                    <span className="diary-group-kcal">
                      {formatNumber(group.total)} kcal
                    </span>
                  </header>
                  <ul className="diary-meal-list">
                    {group.meals.map((meal) => (
                      <li
                        className={`diary-meal-row meal-accent-${group.type}`}
                        key={meal.id}
                      >
                        <div className="diary-meal-name">
                          <strong>{meal.food_name}</strong>
                          <small>
                            {new Date(meal.logged_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                        <span className="diary-meal-kcal">
                          {formatNumber(meal.calories)} kcal
                        </span>
                        {onAskMeal && (
                          <button
                            type="button"
                            className="diary-meal-ask"
                            onClick={() => onAskMeal(meal)}
                          >
                            Ask
                          </button>
                        )}
                        <div className="diary-meal-move">
                          <input
                            aria-label={`New date for ${meal.food_name}`}
                            type="date"
                            value={moveDates[meal.id] || ""}
                            max={localDateKey()}
                            onChange={(e) =>
                              setMoveDates((cur) => ({
                                ...cur,
                                [meal.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="dashboard-text-button"
                            disabled={!moveDates[meal.id]}
                            onClick={() => moveMeal(meal.id, moveDates[meal.id])}
                          >
                            Move
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="diary-side">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            statuses={statuses}
            onToggleFasting={toggleFasting}
          />

          <article
            className={`diary-summary${fastingDay ? " is-fasting" : ""}`}
          >
            {fastingDay ? (
              <div className="diary-summary-fasting">
                <span className="diary-summary-moon" aria-hidden="true">🌙</span>
                <div>
                  <p className="card-eyebrow">
                    {isToday ? "Today" : "Selected day"}
                  </p>
                  <p className="diary-summary-fasting-label">Fasting day</p>
                  <p className="diary-summary-fasting-hint">
                    Intentional — nothing to log.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="diary-summary-head">
                  <p className="card-eyebrow">Day summary</p>
                  {goalMet && (
                    <span className="diary-summary-star" aria-hidden="true">★</span>
                  )}
                </div>
                <div className="diary-summary-ring-row">
                  <div
                    className="diary-summary-ring"
                    style={{ "--calorie-progress": `${calorieProgress}%` }}
                  >
                    <div>
                      <strong>{formatNumber(dayTotals.calories)}</strong>
                      <span>kcal</span>
                    </div>
                  </div>
                  <div className="diary-summary-macros">
                    {[
                      ["Protein", dayTotals.protein, targets.protein, "blue"],
                      ["Carbs", dayTotals.carbs, targets.carbs, "orange"],
                      ["Fat", dayTotals.fat, targets.fat, "purple"],
                    ].map(([label, value, target, tone]) => (
                      <div key={label} className="diary-summary-macro">
                        <div className="diary-summary-macro-head">
                          <span>{label}</span>
                          <strong>{formatNumber(value, 1)} g</strong>
                        </div>
                        <div className={`nutrition-progress nutrition-progress-${tone}`}>
                          <span
                            style={{
                              width: target
                                ? `${Math.min(100, (value / target) * 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {targets.calories > 0 && (
                  <p
                    className={`diary-summary-compare${goalMet ? " is-complete" : ""}`}
                  >
                    {goalMet
                      ? "Goal completed ✓"
                      : remaining >= 0
                      ? `${formatNumber(remaining)} kcal under your target`
                      : `${formatNumber(Math.abs(remaining))} kcal over`}
                  </p>
                )}
              </>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}