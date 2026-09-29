
import { apiFetch } from "./client";

export function lookupBarcode(barcode, token) {
  return apiFetch(`/packaged-food/lookup/${barcode}`, { token });
}

export function logPackagedFood(body, token) {
  return apiFetch("/packaged-food/logs", { method: "POST", token, body });
}

export function suggestBrands(query, token) {
  return apiFetch(`/packaged-food/suggestions?query=${encodeURIComponent(query)}`, { token });
}

export function readPackagedLabel(file, token) {
  const body = new FormData();
  body.append("image", file);
  return apiFetch("/packaged-food/read-label", { method: "POST", token, body });
}
