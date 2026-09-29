from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PackagedFoodLookupResult(BaseModel):
    """What a barcode lookup returns — not yet logged, just found."""
    product_name: str
    brand: str | None = None
    barcode: str
    serving_size_grams: float
    calories_per_serving: float
    protein_g_per_serving: float
    carbs_g_per_serving: float
    fat_g_per_serving: float
    ingredients_text: str | None = None
    image_url: str | None = None
    nutrition_source: str = "open_food_facts"


class PackagedFoodLogCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    brand: str | None = None
    barcode: str | None = None
    serving_size_grams: float = Field(gt=0)
    servings_consumed: float = Field(gt=0, default=1.0)
    calories_per_serving: float = Field(ge=0)
    protein_g_per_serving: float = Field(ge=0)
    carbs_g_per_serving: float = Field(ge=0)
    fat_g_per_serving: float = Field(ge=0)
    ingredients_text: str | None = None
    nutrition_source: str = "open_food_facts"
    logged_at: datetime | None = None
    allow_duplicate: bool = False


class PackagedFoodLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_name: str
    brand: str | None
    barcode: str | None
    serving_size_grams: float
    servings_consumed: float
    calories_per_serving: float
    protein_g_per_serving: float
    carbs_g_per_serving: float
    fat_g_per_serving: float
    total_calories: float
    logged_at: datetime
    ingredients_text: str | None = None
    nutrition_source: str


class PackagedLabelRead(BaseModel):
    product_name: str | None = None
    brand: str | None = None
    barcode: str | None = None
    serving_size_grams: float | None = None
    nutrition_basis: str = "per_100g"
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    ingredients_text: str | None = None
    needs_review: bool = True


class BrandSuggestion(BaseModel):
    product_name: str
    brand: str | None
    barcode: str | None = None
    serving_size_grams: float = 100.0
    calories_per_serving: float
    protein_g_per_serving: float
    carbs_g_per_serving: float = 0.0
    fat_g_per_serving: float = 0.0
    ingredients_text: str | None = None
    reason: str
