"""
Badge: catalog of all badges that exist (seeded once from
data/seed/badges.json via scripts/seed_indb.py or a dedicated seed script —
this table is read-only at runtime). UserBadge is the join table recording
which user earned which badge and when.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # e.g. "streak_7"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(255), nullable=True)

    earned_by: Mapped[list["UserBadge"]] = relationship(back_populates="badge")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_gamification_id", "badge_id", name="uq_user_badge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_gamification_id: Mapped[int] = mapped_column(
        ForeignKey("user_gamification.id", ondelete="CASCADE")
    )
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user_gamification: Mapped["UserGamification"] = relationship(back_populates="earned_badges")
    badge: Mapped["Badge"] = relationship(back_populates="earned_by")