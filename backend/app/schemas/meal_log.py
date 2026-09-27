
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.food_analysis import ConfidenceLabel
from app.models.meal_log import MealType


class MealIngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_name: str
    quantity_grams: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class MealLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meal_type: MealType
    food_name: str
    portion_grams: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    confidence_label: ConfidenceLabel
    logged_at: datetime
    ingredients: list[MealIngredientOut] = []


class ManualMealLogRequest(BaseModel):
    """For logging a meal by search/manual entry, with no FoodAnalysis behind it."""
    meal_type: MealType
    food_name: str
    portion_grams: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    logged_at: datetime | None = None


class MealLogUpdateRequest(BaseModel):
    meal_type: MealType | None = None
    portion_grams: float | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None

# ---------------------------------------------------------------------------
# Append everything below to backend/app/schemas/meal_log.py (it already has
# MealIngredientOut / MealLogOut / ManualMealLogRequest / MealLogUpdateRequest
# — don't duplicate those, just add these three new classes underneath them).
# ---------------------------------------------------------------------------




class ConfirmedItemIn(BaseModel):
    """One food item as confirmed/edited by the user on the analysis screen.
    `confidence_label` is nutrition_service's label for THIS item
    ("database_match" / "database_approx" / "ai_estimate") — it decides how
    trustworthy the whole meal is, it is not stored per-ingredient."""

    name: str = Field(min_length=1, max_length=255)
    grams: float = Field(gt=0, le=5000)
    calories: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    confidence_label: str = "ai_estimate"


class ConfirmMealRequest(BaseModel):
    """Body for POST /api/meal-logs — turns the confirmed analysis screen
    into one real MealLog row (+ one MealIngredient row per item)."""

    meal_type: MealType
    items: list[ConfirmedItemIn] = Field(min_length=1, max_length=30)
    food_name: str | None = Field(default=None, max_length=255)
    logged_at: datetime | None = None