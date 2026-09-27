import { useEffect, useState } from "react";
import { listMealsForDay } from "../api/mealLogsApi";

function dateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function ProgressPage({ token, profile }) {
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    Promise.all(dates.map((date) => listMealsForDay(dateKey(date), token, date)))
      .then((rows) => { if (!cancelled) setDays(dates.map((date, index) => ({ date, meals: rows[index] }))); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || "Could not load progress."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const target = profile.daily_calorie_target ? profile.daily_calorie_target * 7 : null;
  const calories = days.reduce((total, day) => total + day.meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0), 0);
  const progress = target ? Math.min(100, calories / target * 100) : 0;

  return <section className="feature-page"><header className="feature-heading"><p className="dashboard-overline">Progress</p><h1>Your week, at a glance</h1><p>Track your food against the daily calorie target set for your {profile.goal?.replaceAll("_", " ") || "nutrition"} goal.</p></header>{error && <p className="dashboard-error" role="alert">{error}</p>}<article className="dashboard-card progress-week-card"><p className="card-eyebrow">Last 7 days</p><h2>{loading ? "Loading…" : `${Math.round(calories).toLocaleString()} kcal logged`}</h2><p>{target ? `Weekly guide: ${Math.round(target).toLocaleString()} kcal` : "Complete a profile with a goal to set a weekly calorie guide."}</p>{target && <div className="nutrition-progress"><span style={{ width: `${progress}%` }} /></div>}<div className="progress-day-list">{days.map((day) => { const total = day.meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0); return <div className="progress-day-row" key={dateKey(day.date)}><span>{day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span><strong>{Math.round(total).toLocaleString()} kcal</strong></div>; })}</div></article></section>;
}
