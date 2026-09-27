"""
Per-item nutrition estimation for Ahar.

Flow for every food item (name + grams) coming from Gemini or the user:
  1. INDB lookup (recipe-level, per-100 g values)  -> "database_match" / "database_approx"
  2. Unmatched items -> ONE batched Gemini text call (per-100 g)  -> "ai_estimate"
  3. Still unresolved -> nutrition = None, "unresolved" (never invented)

Nutrition is always: per_100g * grams / 100. M3's raw calories are never used.
"""
from __future__ import annotations

import csv
import difflib
import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# backend/app/data/indb/
INDB_DIR = Path(__file__).resolve().parents[1] / "data" / "indb"
INDB_CSV_NAMES = ("INDB_recipes.csv", "INDB.csv", "indb_recipes.csv")

NUTRIENT_KEYS = (
    "energy_kcal", "protein_g", "carb_g", "fat_g", "fibre_g", "free_sugar_g",
)

# CSV header aliases (headers are lower-cased and stripped before matching)
COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "recipe_name": ("recipe_name", "food_name", "name"),
    "recipe_code": ("recipe_code", "food_code", "code"),
    "energy_kcal": ("energy_kcal", "calories", "calorie_kcal", "kcal"),
    "protein_g": ("protein_g", "protein"),
    "carb_g": ("carb_g", "carbs_g", "carbohydrate_g", "carbs", "carbohydrates"),
    "fat_g": ("fat_g", "fat"),
    "fibre_g": ("fibre_g", "fiber_g", "fibre", "fiber"),
    "free_sugar_g": ("freesugar_g", "free_sugar_g", "sugar_g"),
}

# Extra INDB search terms for names Gemini commonly returns.
# Extend this as you see real misses; keys must be lower-case.
QUERY_ALIASES: dict[str, list[str]] = {
    "white rice": ["steamed rice", "plain rice", "boiled rice", "rice"],
    "rice": ["steamed rice", "plain rice", "boiled rice"],
    "chapati": ["chapati/roti", "roti", "phulka"],
    "roti": ["chapati/roti", "chapati", "phulka"],
    "vegetable curry": ["mixed vegetable curry", "mixed vegetable sabzi", "mix veg"],
    "black chickpea curry": ["kala chana curry", "black chana", "kala chana"],
    "chutney": ["coconut chutney", "green chutney", "mint chutney"],
}

MATCH_THRESHOLD = 0.85      # >= this -> database_match
APPROX_THRESHOLD = 0.62     # >= this -> database_approx (UI must show matched name)

_STOP = {"the", "a", "an", "of", "with", "and", "style", "indian"}


def _norm(text: str) -> str:
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9/ ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[ /]+", _norm(text)) if t and t not in _STOP}


def _find_column(headers: dict[str, str], key: str) -> str | None:
    for alias in COLUMN_ALIASES[key]:
        if alias in headers:
            return headers[alias]
    return None


def _to_float(value: Any) -> float | None:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return None if number != number else number  # drop NaN (empty Excel cells)


@lru_cache(maxsize=1)
def _load_indb() -> list[dict[str, Any]]:
    csv_path = next(
        (INDB_DIR / n for n in INDB_CSV_NAMES if (INDB_DIR / n).exists()), None
    )
    if csv_path is None:
        raise FileNotFoundError(
            f"No INDB CSV found in {INDB_DIR} (looked for {INDB_CSV_NAMES})."
        )

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = {h.strip().lower(): h for h in (reader.fieldnames or [])}

        if "ingredient" in headers:
            raise ValueError(
                "INDB CSV is ingredient-level (has an 'ingredient' column). "
                "nutrition_service needs ONE row per recipe with per-100 g values."
            )

        cols = {k: _find_column(headers, k) for k in COLUMN_ALIASES}
        if not cols["recipe_name"] or not cols["energy_kcal"]:
            raise ValueError(
                f"Cannot find recipe_name / energy columns. Headers: {list(headers)}"
            )

        rows: list[dict[str, Any]] = []
        for raw in reader:
            name = (raw.get(cols["recipe_name"]) or "").strip()
            kcal = _to_float(raw.get(cols["energy_kcal"]))
            if not name or kcal is None:
                continue
            per_100g = {
                k: _to_float(raw.get(cols[k])) if cols[k] else None
                for k in NUTRIENT_KEYS
            }
            rows.append({
                "recipe_name": name,
                "recipe_code": (raw.get(cols["recipe_code"]) or "").strip()
                if cols["recipe_code"] else "",
                "per_100g": per_100g,
                "_norm": _norm(name),
                "_tokens": _tokens(name),
            })

    logger.info("Loaded %d INDB recipes from %s", len(rows), csv_path.name)
    return rows


def describe_indb() -> dict[str, Any]:
    """Quick sanity check: python -c "from app.services.nutrition_service import describe_indb as d; print(d())" """
    rows = _load_indb()
    return {"recipes": len(rows), "sample": [r["recipe_name"] for r in rows[:8]]}


# ---------------------------------------------------------------- matching
def _score(query: str, row: dict[str, Any]) -> float:
    q_norm, q_tokens = _norm(query), _tokens(query)
    if not q_tokens:
        return 0.0
    if q_norm == row["_norm"]:
        return 1.0
    name_tokens = row["_tokens"]
    seq = difflib.SequenceMatcher(None, q_norm, row["_norm"]).ratio()
    contain = 0.0
    if q_tokens <= name_tokens:
        # every query word is in the recipe name; prefer names with fewer extras
        # partial-name hits stay below MATCH_THRESHOLD on purpose (-> approx)
        contain = 0.80 - 0.04 * (len(name_tokens) - len(q_tokens))
    elif name_tokens and name_tokens <= q_tokens:
        contain = 0.70 - 0.04 * (len(q_tokens) - len(name_tokens))
    return max(seq, contain)


ALIAS_WEIGHT = 0.88   # curated alias hit: still a name guess, slightly discounted
SPLIT_WEIGHT = 0.80   # "Rasam or Sambar" -> one of the parts: ambiguous -> approx


def _queries_for(item_name: str) -> list[tuple[str, float]]:
    """'Rasam or Sambar' -> [('rasam or sambar',1.0), ('rasam',0.8), ('sambar',0.8), ...aliases]."""
    base = _norm(item_name)
    parts = [p.strip() for p in re.split(r"\bor\b|/|,", base) if p.strip()]
    queries: list[tuple[str, float]] = [(base, 1.0)]
    queries += [(p, SPLIT_WEIGHT) for p in parts if p != base]
    for q, _ in list(queries):
        queries += [(a, ALIAS_WEIGHT) for a in QUERY_ALIASES.get(q, [])]
    seen: set[str] = set()
    return [(q, w) for q, w in queries if not (q in seen or seen.add(q))]


def match_indb(item_name: str) -> dict[str, Any] | None:
    try:
        rows = _load_indb()
    except FileNotFoundError:
        # Don't crash the API: every item falls through to the Gemini estimate.
        logger.error("INDB CSV missing in %s - using Gemini estimates only", INDB_DIR)
        return None
    best_row, best_score = None, 0.0
    for query, weight in _queries_for(item_name):
        for row in rows:
            s = _score(query, row) * weight
            if s > best_score:
                best_row, best_score = row, s
    if best_row is None or best_score < APPROX_THRESHOLD:
        return None
    return {"row": best_row, "score": round(best_score, 2)}


# ---------------------------------------------------------- Gemini fallback
_ESTIMATE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "foods": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "energy_kcal": {"type": "NUMBER"},
                    "protein_g": {"type": "NUMBER"},
                    "carb_g": {"type": "NUMBER"},
                    "fat_g": {"type": "NUMBER"},
                    "fibre_g": {"type": "NUMBER"},
                },
                "required": ["name", "energy_kcal", "protein_g", "carb_g", "fat_g", "fibre_g"],
            },
        }
    },
    "required": ["foods"],
}


def _plausible(n: dict[str, float]) -> bool:
    """Reject impossible per-100 g values (bad LLM output)."""
    try:
        kcal, p, c, f = n["energy_kcal"], n["protein_g"], n["carb_g"], n["fat_g"]
    except KeyError:
        return False
    if not (0 <= kcal <= 900) or any(not (0 <= v <= 100) for v in (p, c, f)):
        return False
    if p + c + f > 105:
        return False
    macro_kcal = 4 * p + 4 * c + 9 * f
    # water-rich foods are low; allow generous slack (fibre/alcohol/rounding)
    return abs(macro_kcal - kcal) <= max(25, 0.35 * kcal)


def _gemini_per_100g(names: list[str]) -> dict[str, dict[str, float]]:
    """One batched text request. Returns {normalized name: per_100g}. Never raises."""
    if not names:
        return {}
    try:
        from google import genai
        from google.genai import types
        from app.core.config import settings

        if not settings.gemini_api_key:
            return {}

        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = (
            "You are a nutrition database for Indian home-style and restaurant food.\n"
            "For each food below give typical nutrition PER 100 g of the food as "
            "normally served (cooked/prepared, not raw). Return JSON only.\n"
            f"Foods: {json.dumps(names, ensure_ascii=False)}"
        )

        for model_name in settings.gemini_model_list:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.0,
                        response_mime_type="application/json",
                        response_schema=_ESTIMATE_SCHEMA,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
                data = json.loads(response.text)
                out: dict[str, dict[str, float]] = {}
                for food in data.get("foods", []):
                    vals = {k: _to_float(food.get(k)) for k in
                            ("energy_kcal", "protein_g", "carb_g", "fat_g", "fibre_g")}
                    if all(v is not None for v in vals.values()) and _plausible(vals):
                        out[_norm(food.get("name", ""))] = vals  # type: ignore[assignment]
                return out
            except Exception as exc:  # try next model on temporary errors
                text = str(exc).upper()
                code = getattr(exc, "status_code", None)
                if code in {429, 500, 502, 503, 504} or "UNAVAILABLE" in text or "HIGH DEMAND" in text:
                    logger.warning("Gemini nutrition estimate: %s busy, trying next", model_name)
                    continue
                raise
    except Exception:
        logger.exception("Gemini nutrition fallback failed")
    return {}


# ------------------------------------------------------------------ public
def _scale(per_100g: dict[str, float | None], grams: float) -> dict[str, float | None]:
    factor = grams / 100.0
    return {
        k: (round(v * factor, 1) if v is not None else None)
        for k, v in per_100g.items()
    }


def estimate_nutrition(
    items: list[dict[str, Any]],
    *,
    use_gemini_fallback: bool = True,
) -> dict[str, Any]:
    """
    items: [{"name": "Chapati", "estimated_mass_g": 80}, ...]
           (also accepts "grams" or "mass_g" so the edited UI values work)
    """
    results: list[dict[str, Any]] = []
    pending: list[int] = []  # indexes needing Gemini fallback

    for item in items:
        name = str(item.get("name", "")).strip()
        grams = next(
            (v for v in (_to_float(item.get(k)) for k in
             ("grams", "mass_g", "estimated_mass_g")) if v is not None),
            None,
        )
        entry: dict[str, Any] = {
            "name": name,
            "portion_g": grams,
            "source": None,
            "confidence_label": "unresolved",
            "matched_name": None,
            "match_score": None,
            "per_100g": None,
            "nutrition": None,
            "needs_confirmation": True,
        }

        if not name or grams is None or grams <= 0:
            entry["note"] = "Missing name or portion size."
            results.append(entry)
            continue

        match = match_indb(name)
        if match:
            row = match["row"]
            entry.update(
                source="INDB",
                confidence_label=(
                    "database_match" if match["score"] >= MATCH_THRESHOLD
                    else "database_approx"
                ),
                matched_name=row["recipe_name"],
                match_score=match["score"],
                per_100g=row["per_100g"],
                nutrition=_scale(row["per_100g"], grams),
            )
        else:
            pending.append(len(results))
        results.append(entry)

    if pending and use_gemini_fallback:
        estimates = _gemini_per_100g([results[i]["name"] for i in pending])
        for i in pending:
            per_100g = estimates.get(_norm(results[i]["name"]))
            if per_100g:
                per_100g = {**per_100g, "free_sugar_g": None}
                results[i].update(
                    source="Gemini",
                    confidence_label="ai_estimate",
                    per_100g=per_100g,
                    nutrition=_scale(per_100g, results[i]["portion_g"]),
                )

    totals = {k: 0.0 for k in NUTRIENT_KEYS}
    resolved = 0
    for r in results:
        if r["nutrition"]:
            resolved += 1
            for k in NUTRIENT_KEYS:
                totals[k] += r["nutrition"].get(k) or 0.0

    return {
        "items": results,
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "total_items": len(results),
        "resolved_items": resolved,
        "is_partial": resolved < len(results),
        "requires_user_confirmation": True,
    }