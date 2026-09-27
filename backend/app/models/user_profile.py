
"""
UserProfile: everything from onboarding — body stats, goal, diet
preference — plus the computed daily macro targets the dashboard tracks
progress against. One-to-one with User.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Sex(str, PyEnum):
    male = "male"
    female = "female"
    other = "other"


class ActivityLevel(str, PyEnum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"


class Goal(str, PyEnum):
    lose_weight = "lose_weight"
    maintain = "maintain"
    gain_weight = "gain_weight"
    build_muscle = "build_muscle"


class DietPreference(str, PyEnum):
    vegetarian = "vegetarian"
    eggetarian = "eggetarian"
    non_vegetarian = "non_vegetarian"
    vegan = "vegan"


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[Sex | None] = mapped_column(Enum(Sex), nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)

    activity_level: Mapped[ActivityLevel | None] = mapped_column(Enum(ActivityLevel), nullable=True)
    goal: Mapped[Goal | None] = mapped_column(Enum(Goal), nullable=True)
    goal_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    calorie_target_choice: Mapped[str] = mapped_column(String(20), default="recommended", nullable=False)
    diet_preference: Mapped[DietPreference | None] = mapped_column(Enum(DietPreference), nullable=True)

    # Free-text, comma-separated is fine for MVP (e.g. "peanuts,lactose")
    allergies_and_restrictions: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ---------- Computed daily targets (Mifflin-St Jeor + goal adjustment) ----------
    daily_calorie_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    daily_protein_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    daily_carbs_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    daily_fat_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="profile")
