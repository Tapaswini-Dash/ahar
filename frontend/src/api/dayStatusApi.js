import { apiFetch } from "./client";

export function getDayStatus(logDate, token) {
  return apiFetch(`/day-status/${logDate}`, { token });
}

export function setFastingDay(logDate, fastingDay, token) {
  return apiFetch(`/day-status/${logDate}/fasting`, {
    method: "POST",
    token,
    body: { fasting_day: fastingDay },
  });
}

export function getDayStatusRange(startDate, endDate, token) {
  const offset = -new Date().getTimezoneOffset();  // minutes, IST = 330
  return apiFetch(
    `/day-status/range/summary?start=${startDate}&end=${endDate}&timezone_offset_minutes=${offset}`,
    { token }
  );
}