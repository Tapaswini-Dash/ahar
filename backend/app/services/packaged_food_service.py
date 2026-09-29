
"""
Barcode lookup via Open Food Facts (free, no API key), plus logging a
packaged product and suggesting better-fit brands from the same OFF search
results — filtered by the user's diet preference and goal.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, time, timedelta, timezone

from app.models.packaged_food_log import PackagedFoodLog
from app.models.meal_log import MealLog, MealType
from app.models.food_analysis import ConfidenceLabel
from app.schemas.packaged_food import (
    BrandSuggestion,
    PackagedFoodLogCreate,
    PackagedFoodLookupResult,
)

logger = logging.getLogger(__name__)

OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"


async def lookup_barcode(barcode: str) -> PackagedFoodLookupResult | None:
    """One real HTTP call to Open Food Facts. Returns None if not found or
    if the product is missing the nutrition fields we need — never guesses."""
    async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": "AharNutrition/1.0 (food diary)"}) as client:
        try:
            response = await client.get(OFF_PRODUCT_URL.format(barcode=barcode))
            response.raise_for_status()
            data = response.json()
        except Exception:
            logger.exception("Open Food Facts lookup failed for barcode %s", barcode)
            raise RuntimeError("Open Food Facts is temporarily unavailable.")

    if data.get("status") != 1:
        return None

    product = data.get("product", {})
    nutriments = product.get("nutriments", {})

    # OFF gives per-100g by default; serving_size is a string like "30 g".
    serving_size_grams = _parse_serving_grams(product.get("serving_size")) or 100.0
    scale = serving_size_grams / 100.0

    calories = nutriments.get("energy-kcal_100g")
    protein = nutriments.get("proteins_100g")
    carbs = nutriments.get("carbohydrates_100g")
    fat = nutriments.get("fat_100g")

    if calories is None or protein is None or carbs is None or fat is None:
        return None  # incomplete data — never invent numbers

    return PackagedFoodLookupResult(
        product_name=product.get("product_name") or "Unknown product",
        brand=product.get("brands"),
        barcode=barcode,
        serving_size_grams=serving_size_grams,
        calories_per_serving=round(calories * scale, 1),
        protein_g_per_serving=round(protein * scale, 1),
        carbs_g_per_serving=round(carbs * scale, 1),
        fat_g_per_serving=round(fat * scale, 1),
        ingredients_text=product.get("ingredients_text"),
        image_url=product.get("image_url"),
        nutrition_source="open_food_facts",
    )


def _parse_serving_grams(serving_size: str | None) -> float | None:
    if not serving_size:
        return None
    import re
    match = re.search(r"([\d.]+)\s*g", serving_size)
    return float(match.group(1)) if match else None


async def log_packaged_food(
    db: AsyncSession,
    user_id: int,
    body: PackagedFoodLogCreate,
) -> PackagedFoodLog:
    logged_at = body.logged_at or datetime.now(timezone.utc)
    local_midnight = datetime.combine(logged_at.date(), time.min, tzinfo=logged_at.tzinfo or timezone.utc)
    day_start = local_midnight.astimezone(timezone.utc)
    day_end = (local_midnight + timedelta(days=1)).astimezone(timezone.utc)
    duplicate_query = select(PackagedFoodLog).where(
        PackagedFoodLog.user_id == user_id,
        PackagedFoodLog.logged_at >= day_start,
        PackagedFoodLog.logged_at < day_end,
    )
    if body.barcode:
        duplicate_query = duplicate_query.where(PackagedFoodLog.barcode == body.barcode)
    else:
        brand_filter = (
            PackagedFoodLog.brand.ilike(body.brand.strip())
            if body.brand and body.brand.strip()
            else PackagedFoodLog.brand.is_(None)
        )
        duplicate_query = duplicate_query.where(
            PackagedFoodLog.barcode.is_(None),
            PackagedFoodLog.product_name.ilike(body.product_name.strip()),
            brand_filter,
        )
    duplicate_result = await db.execute(
        duplicate_query.order_by(PackagedFoodLog.logged_at.desc()).limit(1)
    )
    duplicate = duplicate_result.scalar_one_or_none()
    if duplicate and not body.allow_duplicate:
        raise DuplicatePackagedFood(duplicate)

    log = PackagedFoodLog(
        user_id=user_id,
        product_name=body.product_name,
        brand=body.brand,
        barcode=body.barcode,
        ingredients_text=body.ingredients_text,
        nutrition_source=body.nutrition_source,
        serving_size_grams=body.serving_size_grams,
        servings_consumed=body.servings_consumed,
        calories_per_serving=body.calories_per_serving,
        protein_g_per_serving=body.protein_g_per_serving,
        carbs_g_per_serving=body.carbs_g_per_serving,
        fat_g_per_serving=body.fat_g_per_serving,
        logged_at=logged_at,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    meal = MealLog(
        user_id=user_id,
        meal_type=MealType.snack,
        food_name=body.product_name,
        portion_grams=body.serving_size_grams * body.servings_consumed,
        calories=body.calories_per_serving * body.servings_consumed,
        protein_g=body.protein_g_per_serving * body.servings_consumed,
        carbs_g=body.carbs_g_per_serving * body.servings_consumed,
        fat_g=body.fat_g_per_serving * body.servings_consumed,
        confidence_label=ConfidenceLabel.verified,
        logged_at=log.logged_at,
    )
    db.add(meal)
    await db.commit()
    from app.services.meal_log_service import _apply_side_effects
    await _apply_side_effects(db, user_id, log.logged_at)

    return log


class DuplicatePackagedFood(Exception):
    def __init__(self, existing: PackagedFoodLog):
        self.existing = existing


async def suggest_brands(
    query: str,
    diet_preference: str | None = None,
    goal: str | None = None,
    limit: int = 5,
) -> list[BrandSuggestion]:
    """Searches OFF for the product category, filters/ranks by protein
    (for muscle-gain goals) or lower calories (for weight-loss goals)."""
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 50,
        "fields": "product_name,brands,nutriments,labels_tags,ingredients_text,serving_size,code",
    }
    async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": "AharNutrition/1.0 (food diary)"}) as client:
        try:
            response = await client.get(OFF_SEARCH_URL, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception:
            logger.exception("Open Food Facts search failed for %s", query)
            raise RuntimeError("Open Food Facts product search is temporarily unavailable.")

    candidates = []
    for product in data.get("products", []):
        nutriments = product.get("nutriments", {})
        calories = nutriments.get("energy-kcal_100g")
        protein = nutriments.get("proteins_100g")
        carbs = nutriments.get("carbohydrates_100g")
        fat = nutriments.get("fat_100g")
        if calories is None or protein is None or carbs is None or fat is None:
            continue

        labels = set(product.get("labels_tags", []))
        ingredients = (product.get("ingredients_text") or "").lower()
        if diet_preference == "vegan":
            if "en:vegan" not in labels:
                continue
        elif diet_preference in ("vegetarian", "eggetarian"):
            non_vegetarian = {"en:non-vegetarian", "en:contains-meat", "en:contains-fish"}
            animal_foods = ("chicken", "beef", "pork", "fish", "gelatin", "lard", "anchovy")
            if labels & non_vegetarian or any(food in ingredients for food in animal_foods):
                continue

        serving_grams = _parse_serving_grams(product.get("serving_size")) or 100.0
        scale = serving_grams / 100.0
        brand = product.get("brands")
        if isinstance(brand, list):
            brand = ", ".join(str(value) for value in brand if value)
        candidates.append({
            "product_name": product.get("product_name") or "Unknown",
            "brand": brand,
            "barcode": product.get("code") or None,
            "serving_size_grams": serving_grams,
            "calories_per_serving": round(calories * scale, 1),
            "protein_g_per_serving": round(protein * scale, 1),
            "carbs_g_per_serving": round(carbs * scale, 1),
            "fat_g_per_serving": round(fat * scale, 1),
            "ingredients_text": product.get("ingredients_text"),
        })

    if goal == "build_muscle":
        candidates.sort(key=lambda c: c["protein_g_per_serving"], reverse=True)
        reason = "Higher protein for your muscle-gain goal"
    elif goal == "lose_weight":
        candidates.sort(key=lambda c: c["calories_per_serving"])
        reason = "Lower calories for your weight-loss goal"
    else:
        reason = "Matches your dietary preference"

    return [
        BrandSuggestion(**c, reason=reason)
        for c in candidates[:limit]
    ]
