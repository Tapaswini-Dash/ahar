
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class BadgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str
    icon: str | None
    earned_at: datetime | None = None  # None if not yet earned (used in "locked" list views)



class GamificationOut(BaseModel):
    xp: int
    level: int
    xp_into_level: int
    xp_for_next_level: int
    current_streak: int
    longest_streak: int

    model_config = {"from_attributes": True}