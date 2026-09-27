
"""
MealIngredient: per-ingredient breakdown of a MealLog. Populated when the
analysis came from Layer 2 (LLM ingredient breakdown resolved against
USDA/INDB) or when the user manually edits ingredients via IngredientEditor.
For a Layer 1 (verified) or Layer 3 (rough LLM estimate) meal, this can be
empty — it's optional detail, not required for a MealLog to be valid.
"""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MealIngredient(Base):
    __tablename__ = "meal_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_log_id: Mapped[int] = mapped_column(ForeignKey("meal_logs.id", ondelete="CASCADE"))

    ingredient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity_grams: Mapped[float] = mapped_column(Float, nullable=False)

    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)

    meal_log: Mapped["MealLog"] = relationship(back_populates="ingredients")