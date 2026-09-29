"""
PackagedFoodLog: a logged branded/packaged product (barcode scan or
nutrition-label photo), kept separate from MealLog since the source data
shape is different — per-serving label values instead of a model prediction.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PackagedFoodLog(Base, TimestampMixin):
    __tablename__ = "packaged_food_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    label_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ingredients_text: Mapped[str | None] = mapped_column(String, nullable=True)
    nutrition_source: Mapped[str] = mapped_column(String(32), default="open_food_facts", nullable=False)

    serving_size_grams: Mapped[float] = mapped_column(Float, nullable=False)
    servings_consumed: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Per-serving values as read from the label (before multiplying by servings_consumed).
    calories_per_serving: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g_per_serving: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g_per_serving: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g_per_serving: Mapped[float] = mapped_column(Float, nullable=False)

    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="packaged_food_logs")

    @property
    def total_calories(self) -> float:
        return self.calories_per_serving * self.servings_consumed
