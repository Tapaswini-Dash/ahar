"""Shared nutrition value objects, reused across food_analysis / meal_log / progress schemas."""

from pydantic import BaseModel


class MacroBreakdown(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float


class TopPrediction(BaseModel):
    label: str
    confidence: float