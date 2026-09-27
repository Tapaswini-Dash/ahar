from pydantic import BaseModel


class ReminderStatusOut(BaseModel):
    missed_meals: list[str]
    streak_at_risk: bool
    current_streak: int