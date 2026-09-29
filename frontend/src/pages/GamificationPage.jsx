import { useCallback, useEffect, useState } from "react";
import { getGamification } from "../api/gamificationApi";

/** Derive simple badges client-side from the progress payload. */
function deriveBadges(progress) {
  if (!progress) return [];
  const badges = [];
  const streak = Number(progress.current_streak || 0);
  const longest = Number(progress.longest_streak || 0);
  const level = Number(progress.level || 1);
  const xp = Number(progress.xp || 0);

  if (streak >= 1) badges.push({ id: "first-log", icon: "🌱", label: "First log", tone: "green" });
  if (streak >= 3) badges.push({ id: "three-streak", icon: "🔥", label: "3-day streak", tone: "gold" });
  if (streak >= 7) badges.push({ id: "week-streak", icon: "⚡", label: "7-day streak", tone: "purple" });
  if (longest >= 14) badges.push({ id: "fortnight", icon: "🏔️", label: "14-day best", tone: "blue" });
  if (level >= 2) badges.push({ id: "level-2", icon: "🥈", label: "Level 2", tone: "slate" });
  if (level >= 5) badges.push({ id: "level-5", icon: "🥇", label: "Level 5", tone: "gold" });
  if (xp >= 1000) badges.push({ id: "xp-1k", icon: "💎", label: "1,000 XP", tone: "purple" });
  return badges;
}

function LevelUpModal({ info, onClose }) {
  if (!info) return null;
  return (
    <div className="levelup-backdrop" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div className="levelup-card">
        <div className="levelup-confetti" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ "--i": i }} />
          ))}
        </div>
        <span className="levelup-icon" aria-hidden="true">🎉</span>
        <p className="levelup-eyebrow">Level up</p>
        <h2 id="levelup-title">You reached Level {info.level}!</h2>
        <p className="levelup-xp">+{info.xp_awarded} XP</p>
        <p className="levelup-body">
          Keep logging meals and hitting your goal to unlock the next level.
        </p>
        <button type="button" className="primary-button" onClick={onClose}>
          Keep going
        </button>
      </div>
    </div>
  );
}

export default function GamificationPage({ token }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [levelUp, setLevelUp] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getGamification(token)
      .then((data) => {
        setProgress((prev) => {
          if (prev && data.level > prev.level) {
            setLevelUp({ level: data.level, xp_awarded: data.xp_awarded ?? 0 });
          }
          return data;
        });
      })
      .catch((err) => setError(err.message || "Could not load rewards."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="feature-page reward-page">
        <header className="feature-heading">
          <p className="dashboard-overline">Rewards</p>
          <h1>Every logged meal counts</h1>
          <p>Build a steady routine and earn experience as you go.</p>
        </header>
        <p role="status">Loading your rewards…</p>
      </section>
    );
  }

  const level = Number(progress?.level || 1);
  const xpInto = Number(progress?.xp_into_level || 0);
  const xpForNext = Number(progress?.xp_for_next_level || 100);
  const xpPercent = xpForNext ? Math.min(100, (xpInto / xpForNext) * 100) : 0;
  const streak = Number(progress?.current_streak || 0);
  const longest = Number(progress?.longest_streak || 0);
  const totalXp = Number(progress?.xp || 0);
  const badges = deriveBadges(progress);

  return (
    <section className="feature-page reward-page">
      <header className="feature-heading">
        <p className="dashboard-overline">Rewards</p>
        <h1>Keep your streak glowing</h1>
        <p>Log meals, hit your goal, and turn healthy habits into momentum.</p>
      </header>

      {error && (
        <p className="dashboard-error" role="alert">
          {error} <button type="button" onClick={load}>Try again</button>
        </p>
      )}

      {!error && progress && (
        <>
          {/* Hero level card */}
          <article className="reward-hero">
            <div className="reward-hero-left">
              <p className="card-eyebrow">Current level</p>
              <div className="reward-level-row">
                <span className="reward-level-number">{level}</span>
                <div>
                  <p className="reward-level-name">Ahar Explorer</p>
                  <p className="reward-level-xp">
                    {xpInto} / {xpForNext} XP to Level {level + 1}
                  </p>
                </div>
              </div>
              <div className="reward-xp-track" aria-label={`${xpInto} of ${xpForNext} XP`}>
                <span style={{ width: `${xpPercent}%` }} />
              </div>
              <p className="reward-hero-hint">
                Total XP earned: <strong>{totalXp.toLocaleString()} XP</strong>
              </p>
            </div>
            <div className="reward-hero-right" aria-hidden="true">
              <div className="reward-hero-orb">
                <span>🏅</span>
              </div>
            </div>
          </article>

          {/* Stat tiles */}
          <div className="reward-grid">
            <article className="dashboard-card reward-card reward-card-gold">
              <p className="card-eyebrow">Experience</p>
              <strong className="reward-number">{totalXp.toLocaleString()} XP</strong>
              <p>Each meal log earns points. Daily calorie goals add a bonus boost.</p>
            </article>

            <article className="dashboard-card reward-card reward-card-pink">
              <p className="card-eyebrow">Current streak</p>
              <strong className="reward-number">🔥 {streak}</strong>
              <p>Longest streak: {longest} days</p>
            </article>

            <article className="dashboard-card reward-card reward-card-primary">
              <p className="card-eyebrow">Badges unlocked</p>
              <strong className="reward-number">{badges.length}</strong>
              <p>Keep going to unlock the next milestone.</p>
            </article>
          </div>

          {/* Streak calendar */}
<article className="dashboard-card reward-streak-card">
  <div className="section-heading">
    <div>
      <p className="card-eyebrow">Last 7 days</p>
      <h2>Streak calendar</h2>
    </div>
    {streak > 0 && <span className="week-unit">days</span>}
  </div>

  {streak === 0 ? (
    <div className="streak-empty">
      <span className="streak-empty-icon" aria-hidden="true">🔥</span>
      <div>
        <p className="streak-empty-title">Your streak starts with one meal</p>
        <p className="streak-empty-hint">
          Log any meal today to light up your first day.
        </p>
      </div>
    </div>
  ) : (
    <div className="streak-calendar" aria-label={`${streak}-day streak`}>
      {Array.from({ length: 7 }).map((_, i) => {
        const filled = i < Math.min(streak, 7);
        return (
          <span
            key={i}
            className={`streak-day${filled ? " is-filled" : ""}`}
            aria-hidden="true"
          >
            {filled ? "🔥" : ""}
          </span>
        );
      })}
    </div>
  )}
</article>

          {/* Badges */}
          <article className="dashboard-card reward-badges-card">
            <div className="section-heading">
              <div>
                <p className="card-eyebrow">Achievements</p>
                <h2>Badge collection</h2>
              </div>
              <span className="week-unit">{badges.length} unlocked</span>
            </div>
{badges.length === 0 ? (
  <div className="badge-empty">
    <div className="badge-empty-preview" aria-hidden="true">🌱</div>
    <div>
      <p className="badge-empty-title">First badge: First log</p>
      <p className="badge-empty-hint">Log a meal today to unlock it.</p>
    </div>
  </div>
) : (
              <div className="badge-grid">
                {badges.map((badge) => (
                  <div key={badge.id} className={`badge-tile badge-${badge.tone}`}>
                    <span className="badge-tile-icon" aria-hidden="true">{badge.icon}</span>
                    <span className="badge-tile-label">{badge.label}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      )}

      {levelUp && <LevelUpModal info={levelUp} onClose={() => setLevelUp(null)} />}
    </section>
  );
}