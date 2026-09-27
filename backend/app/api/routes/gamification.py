from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.gamification import GamificationOut
from app.services import gamification_service

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/me", response_model=GamificationOut)
async def read_my_gamification(
    local_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    record = await gamification_service.get_or_create(db, current_user.id)
    return gamification_service.to_progress_dict(record, local_date)


@router.post("/daily-goal")
async def claim_daily_goal(
    log_date: date,
    timezone_offset_minutes: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await gamification_service.claim_daily_goal_reward(
        db, current_user.id, log_date, timezone_offset_minutes
    )
