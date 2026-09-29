from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.day_status import DayStatus
from app.models.meal_log import MealLog
from app.models.user import User
from app.schemas.day_status import DayStatusRead, DayStatusUpdate
from app.services import day_status_service

router = APIRouter(prefix="/day-status", tags=["day-status"])


class DayStatusSummary(BaseModel):
    log_date: date
    fasting_day: bool
    has_meals: bool


@router.get("/range/summary", response_model=List[DayStatusSummary])
async def range_summary(
    start: date = Query(...),
    end: date = Query(...),
    timezone_offset_minutes: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Shift UTC timestamps into the user's local time before extracting the date
    offset = timedelta(minutes=timezone_offset_minutes)
    local_date = func.date(MealLog.logged_at + offset)

    fasting_rows = (
        await db.execute(
            select(DayStatus.log_date, DayStatus.fasting_day).where(
                DayStatus.user_id == user.id,
                DayStatus.log_date >= start,
                DayStatus.log_date <= end,
            )
        )
    ).all()
    fasting_map = {row.log_date: bool(row.fasting_day) for row in fasting_rows}

    meal_days = (
        await db.execute(
            select(local_date.label("log_date"))
            .where(
                MealLog.user_id == user.id,
                local_date >= start,
                local_date <= end,
            )
            .group_by(local_date)
        )
    ).all()
    meal_day_set = {row.log_date for row in meal_days}

    out: List[DayStatusSummary] = []
    cursor = start
    while cursor <= end:
        out.append(
            DayStatusSummary(
                log_date=cursor,
                fasting_day=fasting_map.get(cursor, False),
                has_meals=cursor in meal_day_set,
            )
        )
        cursor += timedelta(days=1)
    return out


@router.get("/{log_date}", response_model=DayStatusRead)
async def read_day_status(
    log_date: date,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await day_status_service.get_or_default(db, user.id, log_date)


@router.post("/{log_date}/fasting", response_model=DayStatusRead)
async def set_fasting(
    log_date: date,
    payload: DayStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await day_status_service.upsert(db, user.id, log_date, payload.fasting_day)