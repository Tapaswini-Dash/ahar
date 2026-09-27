
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, time, timezone
from app.models.meal_log import MealLog
from app.models.user_profile import UserProfile

from app.models.user_gamification import UserGamification

XP_PER_MEAL = 15
STREAK_BONUS_XP = 5  # extra XP for each day the streak is alive, beyond day 1


def xp_required_for_level(level: int) -> int:
    """Cumulative XP needed to reach `level`. Level 1 starts at 0."""
    # Slight ramp so early levels feel fast, later ones take longer.
    return int(50 * (level - 1) * level / 2 * 1.15) if level > 1 else 0


def _level_from_xp(xp: int) -> int:
    level = 1
    while xp >= xp_required_for_level(level + 1):
        level += 1
    return level


async def get_or_create(db: AsyncSession, user_id: int) -> UserGamification:
    result = await db.execute(
        select(UserGamification).where(UserGamification.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        record = UserGamification(
            user_id=user_id, xp=0, level=1, current_streak=0, longest_streak=0
        )
        db.add(record)
        try:
            await db.commit()
            await db.refresh(record)
        except IntegrityError:
            # Two first-time dashboard/rewards requests can race to create it.
            await db.rollback()
            result = await db.execute(
                select(UserGamification).where(UserGamification.user_id == user_id)
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise
    return record


async def register_meal_logged(
    db: AsyncSession, user_id: int, logged_on: date | None = None
) -> UserGamification:
    """Call this once, right after a meal is successfully saved."""
    today = logged_on or date.today()
    record = await get_or_create(db, user_id)

    if record.last_logged_date == today:
        # Already logged today — still award XP for the meal, no streak change.
        gained = XP_PER_MEAL
    elif record.last_logged_date == today - timedelta(days=1):
        record.current_streak += 1
        record.longest_streak = max(record.longest_streak, record.current_streak)
        gained = XP_PER_MEAL + STREAK_BONUS_XP * min(record.current_streak, 10)
    else:
        record.current_streak = 1
        record.longest_streak = max(record.longest_streak, 1)
        gained = XP_PER_MEAL

    record.last_logged_date = today
    record.xp += gained
    record.level = _level_from_xp(record.xp)

    await db.commit()
    await db.refresh(record)
    return record


def to_progress_dict(record: UserGamification, today: date | None = None) -> dict:
    today = today or date.today()
    current_floor = xp_required_for_level(record.level)
    next_ceiling = xp_required_for_level(record.level + 1)
    return {
        "xp": record.xp,
        "level": record.level,
        "xp_into_level": record.xp - current_floor,
        "xp_for_next_level": next_ceiling - current_floor,
        "current_streak": record.current_streak if record.last_logged_date and record.last_logged_date >= today - timedelta(days=1) else 0,
        "longest_streak": record.longest_streak,
        "goal_complete_date": record.goal_complete_date,
    }


async def claim_daily_goal_reward(db: AsyncSession, user_id: int, log_date: date, offset_minutes: int = 0) -> dict:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    target = profile.daily_calorie_target if profile else None
    if not target:
        return {"completed": False, "awarded": False, "xp_awarded": 0, "calories": 0, "target": None}
    offset = timedelta(minutes=offset_minutes)
    start = datetime.combine(log_date, time.min).replace(tzinfo=timezone.utc) - offset
    end = datetime.combine(log_date, time.max).replace(tzinfo=timezone.utc) - offset
    meal_result = await db.execute(select(MealLog.calories).where(MealLog.user_id == user_id, MealLog.logged_at >= start, MealLog.logged_at <= end))
    calories = sum(float(value or 0) for (value,) in meal_result.all())
    if calories < target:
        return {"completed": False, "awarded": False, "xp_awarded": 0, "calories": round(calories), "target": target}
    record = await get_or_create(db, user_id)
    if record.goal_complete_date == log_date:
        return {"completed": True, "awarded": False, "xp_awarded": 0, "calories": round(calories), "target": target, **to_progress_dict(record)}
    record.goal_complete_date = log_date
    record.xp += 25
    record.level = _level_from_xp(record.xp)
    await db.commit()
    await db.refresh(record)
    return {"completed": True, "awarded": True, "xp_awarded": 25, "calories": round(calories), "target": target, **to_progress_dict(record)}
