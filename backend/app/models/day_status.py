from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class DayStatus(Base):
    __tablename__ = "day_status"
    __table_args__ = (UniqueConstraint("user_id", "log_date", name="uq_day_status_user_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    log_date = Column(Date, nullable=False, index=True)
    fasting_day = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)