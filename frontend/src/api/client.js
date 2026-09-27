
// Thin fetch wrapper: builds the URL, attaches the bearer token when present,
// and turns non-2xx responses into a thrown Error with the backend's message.

// Keep API calls on the frontend origin; Vite proxies /api to the backend
// during local development, and production can route /api on the same host.
export const API_PREFIX = "/api";

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (e.g. DELETE) has no body to parse.
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.detail?.message ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      (Array.isArray(data?.detail) ? data.detail[0]?.msg : null) ||
      `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return data;
}
