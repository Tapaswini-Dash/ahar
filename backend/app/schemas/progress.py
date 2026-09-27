
from datetime import date

from pydantic import BaseModel, ConfigDict


class DailyProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_date: date
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    calorie_target: float | None
    protein_target_g: float | None
    carbs_target_g: float | None
    fat_target_g: float | None


class WeeklyProgressOut(BaseModel):
    days: list[DailyProgressOut]
    average_calories: float
    average_protein_g: float
    days_on_target: int  # count of days within a tolerance band of calorie_target