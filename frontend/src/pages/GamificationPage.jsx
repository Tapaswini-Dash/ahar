import { useCallback, useEffect, useState } from "react";
import { getGamification } from "../api/gamificationApi";

export default function GamificationPage({ token }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); setError(""); getGamification(token).then(setProgress).catch((err) => setError(err.message || "Could not load rewards.")).finally(() => setLoading(false)); }, [token]);
  useEffect(() => { load(); }, [load]);
  return <section className="feature-page"><header className="feature-heading"><p className="dashboard-overline">Rewards</p><h1>Every logged meal counts</h1><p>Build a steady routine and earn experience as you go.</p></header>{error && <p className="dashboard-error" role="alert">{error} <button type="button" onClick={load}>Try again</button></p>}{loading && <p role="status">Loading your rewards…</p>}{!loading && !error && <div className="reward-grid"><article className="dashboard-card"><p className="card-eyebrow">Current level</p><strong className="reward-number">{progress.level}</strong><p>{progress.xp_into_level} of {progress.xp_for_next_level} XP to the next level</p></article><article className="dashboard-card"><p className="card-eyebrow">Experience</p><strong className="reward-number">{progress.xp} XP</strong><p>Each meal log earns experience. Daily calorie goals award bonus XP.</p></article><article className="dashboard-card"><p className="card-eyebrow">Current streak</p><strong className="reward-number">🔥 {progress.current_streak}</strong><p>Longest streak: {progress.longest_streak} days</p></article></div>}</section>;
}
