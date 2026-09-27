
// frontend/src/api/foodApi.js
import { apiFetch } from "./client";

export function estimateNutrition(items, token) {
  return apiFetch("/food/estimate-nutrition", { method: "POST", token, body: { items } });
}

export function breakdownIngredients(name, grams, token) {
  return apiFetch("/food/breakdown-ingredients", { method: "POST", token, body: { name, grams } });
}
