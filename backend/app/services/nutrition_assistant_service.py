"""
Turns a plain nutrition analysis into goal- and profile-aware guidance:
allergy warnings, diet-preference conflicts, and swap suggestions toward
the user's stated goal. Pure post-processing on top of nutrition_service's
output — never changes the nutrition numbers themselves.
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

# Naive keyword lists for a first pass — good enough to flag obvious
# conflicts; genuinely ambiguous cases still get a human to check.
_NON_VEG_KEYWORDS = (
    "chicken", "mutton", "fish", "prawn", "shrimp", "egg", "meat", "beef",
    "pork", "bacon", "keema", "kheema", "fish curry",
)
_EGG_ONLY_KEYWORDS = ("egg",)


def _diet_conflict(item_name: str, diet_preference: str) -> str | None:
    name = item_name.lower()
    if diet_preference == "vegan":
        if any(k in name for k in _NON_VEG_KEYWORDS) or "paneer" in name or "curd" in name or "ghee" in name or "milk" in name:
            return f"'{item_name}' may not be vegan-friendly — double-check before logging."
    elif diet_preference == "vegetarian":
        if any(k in name for k in _NON_VEG_KEYWORDS):
            return f"'{item_name}' looks non-vegetarian — you've set your diet as vegetarian."
    elif diet_preference == "eggetarian":
        if any(k in name for k in _NON_VEG_KEYWORDS) and not any(k in name for k in _EGG_ONLY_KEYWORDS):
            return f"'{item_name}' looks non-vegetarian (beyond egg) — you've set eggetarian."
    return None


def _allergy_conflict(item_name: str, allergies_text: str | None) -> str | None:
    if not allergies_text:
        return None
    name = item_name.lower()
    # Split on commas/semicolons/"and" — free text like "peanuts, lactose"
    tokens = [t.strip().lower() for t in allergies_text.replace(" and ", ",").replace(";", ",").split(",") if t.strip()]
    for allergen in tokens:
        if allergen and allergen in name:
            return f"⚠️ '{item_name}' may contain {allergen}, which you've flagged as an allergy/restriction."
    return None


def build_advisories(items: list[dict], profile) -> list[dict]:
    """profile: the UserProfile row (goal, diet_preference, allergies_and_restrictions)."""
    advisories = []
    for item in items:
        name = item.get("name", "")
        diet_msg = _diet_conflict(name, getattr(profile, "diet_preference", None))
        allergy_msg = _allergy_conflict(name, getattr(profile, "allergies_and_restrictions", None))
        if diet_msg:
            advisories.append({"item": name, "type": "diet_conflict", "message": diet_msg})
        if allergy_msg:
            advisories.append({"item": name, "type": "allergy_warning", "message": allergy_msg})
    return advisories


_GOAL_SWAP_PROMPT_TEMPLATE = """You are a nutrition assistant. The user's goal is: {goal}.
They are logging this meal: {items_json}
Their diet preference is {diet_preference}.

For each item, suggest ONE realistic swap or addition that would better serve
their goal (e.g. for muscle gain: more protein; for weight loss: fewer
refined carbs/oil). Keep suggestions realistic Indian home-food swaps.
Return JSON only: {{"swaps": [{{"item": str, "suggestion": str, "reason": str}}]}}
Only include items where a genuinely useful swap exists — skip items that
are already well-aligned with the goal."""


def suggest_goal_swaps(items: list[dict], profile) -> list[dict]:
    """One Gemini call, only when a goal is set — reuses your existing
    Gemini client the same way nutrition_service does."""
    goal = getattr(profile, "goal", None)
    if not goal or goal == "maintain":
        return []

    try:
        from google import genai
        from google.genai import types
        from app.core.config import settings

        if not settings.gemini_api_key:
            return []

        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = _GOAL_SWAP_PROMPT_TEMPLATE.format(
            goal=goal,
            items_json=json.dumps([i.get("name") for i in items]),
            diet_preference=getattr(profile, "diet_preference", "unspecified"),
        )
        schema = {
            "type": "OBJECT",
            "properties": {
                "swaps": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "item": {"type": "STRING"},
                            "suggestion": {"type": "STRING"},
                            "reason": {"type": "STRING"},
                        },
                        "required": ["item", "suggestion", "reason"],
                    },
                }
            },
            "required": ["swaps"],
        }

        for model_name in settings.gemini_model_list:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        response_mime_type="application/json",
                        response_schema=schema,
                    ),
                )
                return json.loads(response.text).get("swaps", [])
            except Exception as exc:
                text = str(exc).upper()
                code = getattr(exc, "status_code", None)
                if code in {429, 500, 502, 503, 504} or "UNAVAILABLE" in text:
                    continue
                raise
    except Exception:
        logger.exception("Goal-swap suggestion failed")
    return []