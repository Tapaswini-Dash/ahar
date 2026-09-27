"""
DailyProgress: one row per user per calendar day, aggregating MealLog +
PackagedFoodLog totals against that day's targets (snapshotted from
UserProfile at day-start, so later target changes don't rewrite history).
Recomputed by progress_service whenever a log is added/edited/deleted for
that day — not written to directly from routes.
"""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class DailyProgress(Base, TimestampMixin):
    __tablename__ = "daily_progress"
    __table_args__ = (UniqueConstraint("user_id", "log_date", name="uq_daily_progress_user_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    log_date: Mapped[date] = mapped_column(Date, nullable=False)

    total_calories: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_protein_g: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_carbs_g: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_fat_g: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Snapshotted from UserProfile at the time of the first log this day.
    calorie_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="daily_progress_entries")