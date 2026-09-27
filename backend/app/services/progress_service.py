
"""
Recomputes DailyProgress for a user/day from their real MealLog rows.
Called by meal_log_service after any add/edit/delete — never written to
directly from routes (see DailyProgress's docstring).

Targets (calorie_target etc.) are left untouched here: they're set once by
onboarding_service when a user first logs a meal on a given day, and are
intentionally NOT recalculated on every meal edit (a target is a snapshot,
not a live value) — see DailyProgress's docstring.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_progress import DailyProgress
from app.models.meal_log import MealLog


async def recompute_daily_progress(
    db: AsyncSession,
    user_id: int,
    log_date: date,
    timezone_offset_minutes: int = 0,
) -> DailyProgress:
    offset = timedelta(minutes=timezone_offset_minutes)
    result = await db.execute(
        select(MealLog).where(
            MealLog.user_id == user_id,
            MealLog.logged_at >= date_start(log_date) - offset,
            MealLog.logged_at <= date_end(log_date) - offset,
        )
    )
    meals = list(result.scalars().all())

    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for meal in meals:
        totals["calories"] += meal.calories
        totals["protein_g"] += meal.protein_g
        totals["carbs_g"] += meal.carbs_g
        totals["fat_g"] += meal.fat_g

    result = await db.execute(
        select(DailyProgress).where(
            DailyProgress.user_id == user_id,
            DailyProgress.log_date == log_date,
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        # First log of the day: snapshot today's targets from the user's
        # profile, if it exists. (onboarding_service owns UserProfile —
        # this only reads it, never writes targets.)
        targets = await _current_targets(db, user_id)
        progress = DailyProgress(
            user_id=user_id,
            log_date=log_date,
            calorie_target=targets.get("calorie_target"),
            protein_target_g=targets.get("protein_target_g"),
            carbs_target_g=targets.get("carbs_target_g"),
            fat_target_g=targets.get("fat_target_g"),
        )
        db.add(progress)

    progress.total_calories = round(totals["calories"], 1)
    progress.total_protein_g = round(totals["protein_g"], 1)
    progress.total_carbs_g = round(totals["carbs_g"], 1)
    progress.total_fat_g = round(totals["fat_g"], 1)

    await db.commit()
    await db.refresh(progress)
    return progress


async def _current_targets(db: AsyncSession, user_id: int) -> dict:
    """Read the latest daily targets from the user's onboarding profile."""
    try:
        from app.models.user_profile import UserProfile
    except ImportError:
        return {}

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        return {}

    return {
        "calorie_target": profile.daily_calorie_target,
        "protein_target_g": profile.daily_protein_target_g,
        "carbs_target_g": profile.daily_carbs_target_g,
        "fat_target_g": profile.daily_fat_target_g,
    }


def date_start(d: date):
    from datetime import datetime, time, timezone
    return datetime.combine(d, time.min).replace(tzinfo=timezone.utc)


def date_end(d: date):
    from datetime import datetime, time, timezone
    return datetime.combine(d, time.max).replace(tzinfo=timezone.utc)
