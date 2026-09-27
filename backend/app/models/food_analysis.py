
"""
FoodAnalysis: the DRAFT result of analyzing an uploaded meal photo, before
the user confirms it into a MealLog. Kept as a separate table (rather than
writing straight to MealLog) so a user can see M2's top-3 guesses, edit
portions, or discard a bad analysis without ever creating a real log entry.

`source` records which layer of the fallback pipeline actually produced the
nutrition numbers, and `confidence_label` is what the UI shows next to the
result so an estimate is never presented with the same weight as a verified
database match:
    m4_verified        -> Layer 1: M2 label matched directly to INDB/M4
    ingredient_breakdown -> Layer 2: LLM broke the dish into ingredients,
                            each resolved against USDA/INDB per-ingredient data
    llm_estimate        -> Layer 3: LLM's direct estimate, last resort
"""

from enum import Enum as PyEnum

from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AnalysisSource(str, PyEnum):
    m4_verified = "m4_verified"
    ingredient_breakdown = "ingredient_breakdown"
    llm_estimate = "llm_estimate"


class ConfidenceLabel(str, PyEnum):
    verified = "verified"        # Layer 1 match
    estimated = "estimated"      # Layer 2 breakdown
    rough_guess = "rough_guess"  # Layer 3 LLM estimate


class AnalysisStatus(str, PyEnum):
    pending = "pending"      # shown to user, awaiting confirm/discard
    confirmed = "confirmed"  # became a MealLog
    discarded = "discarded"


class FoodAnalysis(Base, TimestampMixin):
    __tablename__ = "food_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    raw_text_input: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # M2's top prediction
    predicted_label: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0–1.0

    # Full top-K list for the "pick one" UI when confidence is 40–60%.
    # Shape: [{"label": str, "confidence": float}, ...]
    top_k_predictions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # M3's estimated portion, used as the starting point in PortionEditor.
    estimated_portion_grams: Mapped[float | None] = mapped_column(Float, nullable=True)

    source: Mapped[AnalysisSource] = mapped_column(default=AnalysisSource.llm_estimate)
    confidence_label: Mapped[ConfidenceLabel] = mapped_column(default=ConfidenceLabel.rough_guess)
    status: Mapped[AnalysisStatus] = mapped_column(default=AnalysisStatus.pending)

    # Nutrition at the estimated portion, before the user edits anything.
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="food_analyses")
    meal_log: Mapped["MealLog | None"] = relationship(back_populates="food_analysis", uselist=False)