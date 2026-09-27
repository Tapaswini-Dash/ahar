"""
User model. Supports both email/password AND Google Sign-In on the same
account — hashed_password is nullable because a Google-only user never sets
one. google_sub is Google's stable per-user id (from the verified ID token's
'sub' claim), not their email, since email can technically change.
"""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Nullable: a user who signed up via Google may never set a password.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Nullable + unique: only set for users who used "Sign in with Google".
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ---------- Relationships ----------
    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    gamification: Mapped["UserGamification | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    food_analyses: Mapped[list["FoodAnalysis"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    meal_logs: Mapped[list["MealLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    packaged_food_logs: Mapped[list["PackagedFoodLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    daily_progress_entries: Mapped[list["DailyProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def auth_provider(self) -> str:
        if self.hashed_password and self.google_sub:
            return "email+google"
        return "google" if self.google_sub else "email"