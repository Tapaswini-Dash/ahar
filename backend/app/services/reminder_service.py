
"""
Computes what nudges a user should see right now (missed meal windows,
streak at risk) by checking today's real MealLog rows against expected
meal times — no persisted Reminder rows, so there's nothing to seed or
clean up. If you later want push/email delivery, a scheduled job can call
get_reminder_status() for every user and decide what to send from there.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal_log import MealLog, MealType
from app.services import gamification_service

# (start_hour, end_hour) in the app's assumed local reference — 24h clock.
# "Missed" means: past end_hour today and that meal type has no MealLog yet.
MEAL_WINDOWS: dict[MealType, tuple[int, int]] = {
    MealType.breakfast: (5, 11),
    MealType.lunch: (11, 16),
    MealType.dinner: (18, 23),
}

# If it's this late and NOTHING has been logged today, the streak itself
# is at risk of breaking tonight — a stronger nudge than a single missed meal.
STREAK_RISK_HOUR = 20


async def _meals_logged_today(db: AsyncSession, user_id: int, today: date) -> set[MealType]:
    start = datetime.combine(today, time.min).replace(tzinfo=timezone.utc)
    end = datetime.combine(today, time.max).replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(MealLog.meal_type).where(
            MealLog.user_id == user_id,
            MealLog.logged_at >= start,
            MealLog.logged_at <= end,
        )
    )
    return {row[0] for row in result.all()}


async def get_reminder_status(
    db: AsyncSession,
    user_id: int,
    now: datetime | None = None,
) -> dict:
    """Returns what to nudge the user about right now:
    - missed_meals: meal types whose window has closed with nothing logged
    - streak_at_risk: true if it's late and today has zero meals logged
      while the user has an active streak worth protecting
    - current_streak: for the message ("don't lose your 5-day streak")
    """
    now = now or datetime.now(timezone.utc)
    today = now.date()
    current_hour = now.hour

    logged_today = await _meals_logged_today(db, user_id, today)

    missed_meals = [
        meal_type.value
        for meal_type, (_, end_hour) in MEAL_WINDOWS.items()
        if current_hour >= end_hour and meal_type not in logged_today
    ]

    gamification = await gamification_service.get_or_create(db, user_id)
    streak_at_risk = (
        current_hour >= STREAK_RISK_HOUR
        and not logged_today
        and gamification.current_streak > 0
    )

    return {
        "missed_meals": missed_meals,
        "streak_at_risk": streak_at_risk,
        "current_streak": gamification.current_streak,
    }