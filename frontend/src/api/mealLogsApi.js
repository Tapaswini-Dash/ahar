
import { apiFetch } from "./client";

export function localDateTimeIso(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const localClock = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19);
  return `${localClock}${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
}

export function localDateTimeInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateAtNoonIso(dateKey) {
  // Build noon in the user's local timezone. Parsing YYYY-MM-DD directly uses
  // UTC in browsers and can move the saved calendar date in some timezones.
  const [year, month, day] = dateKey.split("-").map(Number);
  return localDateTimeIso(new Date(year, month - 1, day, 12));
}

export function confirmMeal({ mealType, items, foodName, logDate, loggedAt }, token) {
  return apiFetch("/meal-logs", {
    method: "POST",
    token,
    body: {
      meal_type: mealType,
      items,
      food_name: foodName || undefined,
      logged_at: loggedAt ? localDateTimeIso(new Date(loggedAt)) : logDate ? localDateAtNoonIso(logDate) : localDateTimeIso(),
    },
  });
}

export function listMealsForDay(logDate, token, date = new Date()) {
  const offset = -date.getTimezoneOffset();
  return apiFetch(`/meal-logs?log_date=${logDate}&timezone_offset_minutes=${offset}`, { token });
}

export function moveMealToDate(mealId, logDate, token) {
  return apiFetch(`/meal-logs/${mealId}`, {
    method: "PATCH",
    token,
    body: { logged_at: localDateAtNoonIso(logDate) },
  });
}
