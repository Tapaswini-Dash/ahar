"""
Turns confirmed food items (from the analyze-image screen, or a manual
entry) into a real MealLog + MealIngredient rows, and keeps DailyProgress
in sync. This is the only place that writes to meal_logs / meal_ingredients
— routes call into this, they never touch the models directly.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.food_analysis import ConfidenceLabel
from app.models.meal_ingredient import MealIngredient
from app.models.meal_log import MealLog
from app.schemas.meal_log import ConfirmMealRequest, ManualMealLogRequest
from app.services import gamification_service, progress_service

logger = logging.getLogger(__name__)

# Worst-case wins: if even one item in the meal is an AI estimate, the whole
# meal is labelled as an estimate — never mark a meal "verified" because
# most of it happened to match INDB.
_LABEL_RANK = {
    "database_match": 0,
    "database_approx": 1,
    "ai_estimate": 2,
}
_RANK_TO_ENUM = {
    0: ConfidenceLabel.verified,
    1: ConfidenceLabel.estimated,
    2: ConfidenceLabel.rough_guess,
}


def _meal_food_name(items: list, override: str | None) -> str:
    if override:
        return override
    if len(items) == 1:
        return items[0].name
    return f"{items[0].name} + {len(items) - 1} more"


def _meal_confidence_label(items: list) -> ConfidenceLabel:
    worst = max(_LABEL_RANK.get(i.confidence_label, 2) for i in items)
    return _RANK_TO_ENUM[worst]


async def create_meal_log_from_confirmed_items(
    db: AsyncSession,
    user_id: int,
    body: ConfirmMealRequest,
) -> MealLog:
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for item in body.items:
        totals["calories"] += item.calories
        totals["protein_g"] += item.protein_g
        totals["carbs_g"] += item.carbs_g
        totals["fat_g"] += item.fat_g

    logged_at = body.logged_at or datetime.now(timezone.utc)

    meal = MealLog(
        user_id=user_id,
        meal_type=body.meal_type,
        food_name=_meal_food_name(body.items, body.food_name),
        portion_grams=round(sum(i.grams for i in body.items), 1),
        calories=round(totals["calories"], 1),
        protein_g=round(totals["protein_g"], 1),
        carbs_g=round(totals["carbs_g"], 1),
        fat_g=round(totals["fat_g"], 1),
        confidence_label=_meal_confidence_label(body.items),
        logged_at=logged_at,
    )
    meal.ingredients = [
        MealIngredient(
            ingredient_name=item.name,
            quantity_grams=item.grams,
            calories=item.calories,
            protein_g=item.protein_g,
            carbs_g=item.carbs_g,
            fat_g=item.fat_g,
        )
        for item in body.items
    ]

    db.add(meal)
    await db.commit()
    await db.refresh(meal, attribute_names=["ingredients"])

    await _apply_side_effects(db, user_id, logged_at)
    return meal


async def create_manual_meal_log(
    db: AsyncSession,
    user_id: int,
    body: ManualMealLogRequest,
) -> MealLog:
    logged_at = body.logged_at or datetime.now(timezone.utc)

    meal = MealLog(
        user_id=user_id,
        meal_type=body.meal_type,
        food_name=body.food_name,
        portion_grams=body.portion_grams,
        calories=body.calories,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        confidence_label=ConfidenceLabel.verified,
        logged_at=logged_at,
    )

    db.add(meal)
    await db.commit()
    await db.refresh(meal)

    await _apply_side_effects(db, user_id, logged_at)
    return meal


async def list_meal_logs_for_day(
    db: AsyncSession,
    user_id: int,
    log_date,
    timezone_offset_minutes: int = 0,
) -> list[MealLog]:
    from datetime import datetime as dt, time as time_

    # The browser sends its local UTC offset so a calendar date means the
    # user's local day, rather than a UTC day that can hide late-night meals.
    offset = timedelta(minutes=timezone_offset_minutes)
    start = dt.combine(log_date, time_.min).replace(tzinfo=timezone.utc) - offset
    end = dt.combine(log_date, time_.max).replace(tzinfo=timezone.utc) - offset

    result = await db.execute(
        select(MealLog)
        .options(selectinload(MealLog.ingredients))
        .where(
            MealLog.user_id == user_id,
            MealLog.logged_at >= start,
            MealLog.logged_at <= end,
        )
        .order_by(MealLog.logged_at)
    )
    return list(result.scalars().unique().all())


async def delete_meal_log(db: AsyncSession, user_id: int, meal_log_id: int) -> bool:
    result = await db.execute(
        select(MealLog).where(MealLog.id == meal_log_id, MealLog.user_id == user_id)
    )
    meal = result.scalar_one_or_none()
    if meal is None:
        return False

    log_date = meal.logged_at.date()
    await db.delete(meal)
    await db.commit()

    await progress_service.recompute_daily_progress(db, user_id, log_date)
    return True


async def move_meal_log_date(
    db: AsyncSession, user_id: int, meal_log_id: int, logged_at: datetime
) -> MealLog | None:
    result = await db.execute(
        select(MealLog).where(MealLog.id == meal_log_id, MealLog.user_id == user_id)
    )
    meal = result.scalar_one_or_none()
    if meal is None:
        return None
    previous_date = meal.logged_at.date()
    meal.logged_at = logged_at
    await db.commit()
    await db.refresh(meal)
    for day in {previous_date, logged_at.date()}:
        try:
            await progress_service.recompute_daily_progress(db, user_id, day)
        except Exception:
            logger.exception("recompute_daily_progress failed after meal date change")
    return meal


async def _apply_side_effects(db: AsyncSession, user_id: int, logged_at: datetime) -> None:
    """Progress recompute and gamification are important but must never
    turn an already-saved meal into a 500 for the user. Log and swallow —
    surfacing failures here belongs in monitoring, not the request cycle."""
    log_date = logged_at.date()
    offset = logged_at.utcoffset()
    timezone_offset_minutes = int(offset.total_seconds() / 60) if offset else 0
    try:
        await progress_service.recompute_daily_progress(
            db, user_id, log_date, timezone_offset_minutes=timezone_offset_minutes
        )
    except Exception:
        logger.exception("recompute_daily_progress failed after meal save")
    try:
        await gamification_service.register_meal_logged(db, user_id, log_date)
    except Exception:
        logger.exception("register_meal_logged failed after meal save")
