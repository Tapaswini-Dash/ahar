
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_profile import ActivityLevel, Goal, UserProfile
from app.schemas.onboarding import OnboardingRequest


_ACTIVITY_FACTORS = {
    ActivityLevel.sedentary: 1.2,
    ActivityLevel.light: 1.375,
    ActivityLevel.moderate: 1.55,
    ActivityLevel.active: 1.725,
    ActivityLevel.very_active: 1.9,
}


async def get_profile(db: AsyncSession, user_id: int) -> UserProfile | None:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def save_profile(
    db: AsyncSession,
    user_id: int,
    body: OnboardingRequest,
) -> UserProfile:
    profile = await get_profile(db, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)

    for field_name, value in body.model_dump().items():
        setattr(profile, field_name, value)

    targets = _estimate_targets(body)
    profile.daily_calorie_target = targets["calories"]
    profile.daily_protein_target_g = targets["protein_g"]
    profile.daily_carbs_target_g = targets["carbs_g"]
    profile.daily_fat_target_g = targets["fat_g"]
    profile.onboarding_completed = True

    await db.commit()
    await db.refresh(profile)
    return profile


def _estimate_targets(body: OnboardingRequest) -> dict[str, float | None]:
    if body.age < 18:
        return {"calories": None, "protein_g": None, "carbs_g": None, "fat_g": None}

    sex_adjustment = {"male": 5, "female": -161, "other": -78}[body.sex.value]
    resting_energy = (
        10 * body.weight_kg
        + 6.25 * body.height_cm
        - 5 * body.age
        + sex_adjustment
    )
    daily_energy = resting_energy * _ACTIVITY_FACTORS[body.activity_level]
    goal_adjustment = {
        Goal.lose_weight: -300,
        Goal.maintain: 0,
        Goal.gain_weight: 250,
        Goal.build_muscle: 150,
    }[body.goal]
    if body.goal in {Goal.lose_weight, Goal.gain_weight} and body.goal_weight_kg:
        direction = -1 if body.goal == Goal.lose_weight else 1
        goal_adjustment = direction * min(500, max(150, abs(body.goal_weight_kg - body.weight_kg) * 25))
    calories = max(1000, daily_energy + goal_adjustment)
    if body.calorie_target_choice == "custom" and body.custom_calorie_target:
        calories = body.custom_calorie_target
    protein_g = body.weight_kg * 1.6
    fat_g = calories * 0.25 / 9
    carbs_g = max(0, (calories - protein_g * 4 - fat_g * 9) / 4)

    return {
        "calories": round(calories),
        "protein_g": round(protein_g),
        "carbs_g": round(carbs_g),
        "fat_g": round(fat_g),
    }
