from pydantic import BaseModel, ConfigDict

from app.models.food_analysis import AnalysisSource, AnalysisStatus, ConfidenceLabel
from app.schemas.nutrition import MacroBreakdown, TopPrediction


class TextAnalysisRequest(BaseModel):
    """For the 'describe what you ate' text-input flow (no image)."""
    text: str


class FoodAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    predicted_label: str
    confidence: float
    top_k_predictions: list[TopPrediction] | None = None
    estimated_portion_grams: float | None = None
    source: AnalysisSource
    confidence_label: ConfidenceLabel
    status: AnalysisStatus
    macros: MacroBreakdown | None = None

    @classmethod
    def from_orm_with_macros(cls, analysis) -> "FoodAnalysisOut":
        """Build the response, packing the four flat macro columns into `macros`."""
        data = cls.model_validate(analysis).model_dump()
        if analysis.calories is not None:
            data["macros"] = MacroBreakdown(
                calories=analysis.calories,
                protein_g=analysis.protein_g,
                carbs_g=analysis.carbs_g,
                fat_g=analysis.fat_g,
            )
        return cls(**data)


class SelectTopKRequest(BaseModel):
    """When confidence was 40-60%, the user picks one of the top-K labels shown."""
    selected_label: str


class ConfirmAnalysisRequest(BaseModel):
    """Turns a pending FoodAnalysis into a MealLog. Portion/macros can be
    edited from what M3/the LLM estimated before confirming."""
    meal_type: str
    portion_grams: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float