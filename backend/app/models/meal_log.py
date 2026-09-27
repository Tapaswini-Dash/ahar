
"""
MealLog: a CONFIRMED entry in the user's food diary. Created either from a
confirmed FoodAnalysis (image/text flow) or entered directly (manual search
flow). This is what daily/weekly progress is calculated from — never the
draft FoodAnalysis table.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.food_analysis import ConfidenceLabel


class MealType(str, PyEnum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class MealLog(Base, TimestampMixin):
    __tablename__ = "meal_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Nullable: only set when this log came from the image/text analysis flow.
    food_analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("food_analyses.id", ondelete="SET NULL"), unique=True, nullable=True
    )

    meal_type: Mapped[MealType] = mapped_column(nullable=False)
    food_name: Mapped[str] = mapped_column(String(255), nullable=False)
    portion_grams: Mapped[float] = mapped_column(Float, nullable=False)

    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    confidence_label: Mapped[ConfidenceLabel] = mapped_column(default=ConfidenceLabel.verified)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="meal_logs")
    food_analysis: Mapped["FoodAnalysis | None"] = relationship(back_populates="meal_log")
    ingredients: Mapped[list["MealIngredient"]] = relationship(
        back_populates="meal_log", cascade="all, delete-orphan"
    )