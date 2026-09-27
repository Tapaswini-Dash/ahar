
import { apiFetch } from "./client";

export function register({ email, password, fullName }) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: { email, password, full_name: fullName },
  });
}

export function login({ email, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function fetchCurrentUser(token) {
  return apiFetch("/auth/me", { token });
}

export function loginWithGoogle(idToken) {
  return apiFetch("/auth/google", {
    method: "POST",
    body: { id_token: idToken },
  });
}
