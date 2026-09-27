from datetime import date

from sqlalchemy import Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class UserGamification(Base, TimestampMixin):
    __tablename__ = "user_gamification"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)

    # Existing installs used these physical column names; keep the Python
    # API current while mapping onto the established database columns.
    xp: Mapped[int] = mapped_column("total_points", Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)

    current_streak: Mapped[int] = mapped_column("current_streak_days", Integer, default=0)
    longest_streak: Mapped[int] = mapped_column("longest_streak_days", Integer, default=0)
    last_logged_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    goal_complete_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship(back_populates="gamification")
    earned_badges: Mapped[list["UserBadge"]] = relationship(
        back_populates="user_gamification", cascade="all, delete-orphan"
    )
