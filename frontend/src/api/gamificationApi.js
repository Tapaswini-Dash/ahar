import { apiFetch } from "./client";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getGamification(token, date = localDate()) {
  return apiFetch(`/gamification/me?local_date=${date}`, { token });
}

export function claimDailyGoal(date, token) {
  const offset = -new Date().getTimezoneOffset();
  return apiFetch(`/gamification/daily-goal?log_date=${date}&timezone_offset_minutes=${offset}`, { method: "POST", token });
}
