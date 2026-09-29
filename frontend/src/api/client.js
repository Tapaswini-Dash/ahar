
// Thin fetch wrapper: builds the URL, attaches the bearer token when present,
// and turns non-2xx responses into a thrown Error with the backend's message.

// Keep API calls on the frontend origin; Vite proxies /api to the backend
// during local development, and production can route /api on the same host.
export const API_PREFIX = "/api";
const ACCESS_KEY = "ahar_access_token";
const REFRESH_KEY = "ahar_refresh_token";
let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const tokens = await response.json().catch(() => null);
      if (!response.ok || !tokens?.access_token || !tokens?.refresh_token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      localStorage.setItem(ACCESS_KEY, tokens.access_token);
      localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
      window.dispatchEvent(new Event("ahar:auth-token"));
      return tokens.access_token;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = {};
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  let activeToken = localStorage.getItem(ACCESS_KEY) || token;
  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  let response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (response.status === 401 && activeToken && path !== "/auth/refresh") {
    try {
      activeToken = await refreshAccessToken();
      headers.Authorization = `Bearer ${activeToken}`;
      response = await fetch(`${API_PREFIX}${path}`, {
        method,
        headers,
        body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
      });
    } catch (error) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      window.dispatchEvent(new Event("ahar:auth-expired"));
      throw error;
    }
  }

  // 204 No Content (e.g. DELETE) has no body to parse.
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.detail?.message ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      (Array.isArray(data?.detail) ? data.detail[0]?.msg : null) ||
      `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}
