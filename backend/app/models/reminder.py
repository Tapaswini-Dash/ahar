"""
Reminder: user-level reminder preferences (e.g. "remind me to log lunch",
"warn me if my streak is about to break"). A background job (out of scope
for MVP — can be a simple scheduled script later) reads these to decide
who to notify and when.
"""

from datetime import time
from enum import Enum as PyEnum

from sqlalchemy import Boolean, ForeignKey, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ReminderType(str, PyEnum):
    meal_reminder = "meal_reminder"
    streak_risk = "streak_risk"


class Reminder(Base, TimestampMixin):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    reminder_type: Mapped[ReminderType] = mapped_column(nullable=False)
    scheduled_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="reminders")