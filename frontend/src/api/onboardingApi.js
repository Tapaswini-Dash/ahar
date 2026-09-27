
import { apiFetch } from "./client";

export function getProfile(token) {
  return apiFetch("/onboarding/profile", { token });
}

export function saveProfile(profile, token) {
  return apiFetch("/onboarding/profile", {
    method: "PUT",
    token,
    body: profile,
  });
}
