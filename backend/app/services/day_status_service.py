from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.day_status import DayStatus


async def get_or_default(db: AsyncSession, user_id: int, log_date: date) -> DayStatus:
    result = await db.execute(
        select(DayStatus).where(
            DayStatus.user_id == user_id,
            DayStatus.log_date == log_date,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return DayStatus(user_id=user_id, log_date=log_date, fasting_day=False)
    return row


async def upsert(
    db: AsyncSession, user_id: int, log_date: date, fasting_day: bool
) -> DayStatus:
    result = await db.execute(
        select(DayStatus).where(
            DayStatus.user_id == user_id,
            DayStatus.log_date == log_date,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = DayStatus(user_id=user_id, log_date=log_date, fasting_day=fasting_day)
        db.add(row)
    else:
        row.fasting_day = fasting_day
    await db.commit()
    await db.refresh(row)
    return row