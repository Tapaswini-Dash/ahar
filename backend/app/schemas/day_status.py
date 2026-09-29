from datetime import date
from pydantic import BaseModel


class DayStatusRead(BaseModel):
    log_date: date
    fasting_day: bool

    class Config:
        from_attributes = True


class DayStatusUpdate(BaseModel):
    fasting_day: bool