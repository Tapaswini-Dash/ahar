from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(10), default="🏅")
    # "streak" | "total_meals" | "level" — what check_and_award reads to decide
    criteria_type: Mapped[str] = mapped_column(String(30))
    criteria_value: Mapped[int] = mapped_column(default=0)

    earned_by: Mapped[list['UserBadge']] = relationship(back_populates='badge', cascade='all, delete-orphan')

class UserBadge(Base):
    __tablename__ = 'user_badges'
    __table_args__ = (UniqueConstraint('user_gamification_id', 'badge_id', name='uq_user_badge'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_gamification_id: Mapped[int] = mapped_column(ForeignKey('user_gamification.id', ondelete='CASCADE'), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey('badges.id', ondelete='CASCADE'), index=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user_gamification: Mapped['UserGamification'] = relationship(back_populates='earned_badges')
    badge: Mapped[Badge] = relationship(back_populates='earned_by')
