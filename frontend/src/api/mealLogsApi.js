
import { apiFetch } from "./client";

function localDateTimeIso(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const localClock = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19);
  return `${localClock}${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
}

export function confirmMeal({ mealType, items, foodName, logDate }, token) {
  return apiFetch("/meal-logs", {
    method: "POST",
    token,
    body: {
      meal_type: mealType,
      items,
      food_name: foodName || undefined,
      logged_at: localDateTimeIso(logDate ? new Date(`${logDate}T12:00:00`) : new Date()),
    },
  });
}

export function listMealsForDay(logDate, token, date = new Date()) {
  const offset = -date.getTimezoneOffset();
  return apiFetch(`/meal-logs?log_date=${logDate}&timezone_offset_minutes=${offset}`, { token });
}
