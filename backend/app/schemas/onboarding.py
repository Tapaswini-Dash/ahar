from pydantic import BaseModel, ConfigDict, Field

from app.models.user_profile import ActivityLevel, DietPreference, Goal, Sex


class OnboardingRequest(BaseModel):
    age: int = Field(ge=10, le=100)
    sex: Sex
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=400)
    activity_level: ActivityLevel
    goal: Goal
    goal_weight_kg: float | None = Field(default=None, gt=0, le=400)
    calorie_target_choice: str = Field(default="recommended", pattern="^(recommended|custom)$")
    custom_calorie_target: int | None = Field(default=None, ge=1000, le=10000)
    diet_preference: DietPreference
    allergies_and_restrictions: str | None = None


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    age: int | None
    sex: Sex | None
    height_cm: float | None
    weight_kg: float | None
    activity_level: ActivityLevel | None
    goal: Goal | None
    goal_weight_kg: float | None = None
    calorie_target_choice: str = "recommended"
    diet_preference: DietPreference | None
    allergies_and_restrictions: str | None
    daily_calorie_target: float | None
    daily_protein_target_g: float | None
    daily_carbs_target_g: float | None
    daily_fat_target_g: float | None
    onboarding_completed: bool
