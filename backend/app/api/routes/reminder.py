from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.reminder import ReminderStatusOut
from app.services import reminder_service

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("/me", response_model=ReminderStatusOut)
async def read_my_reminders(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await reminder_service.get_reminder_status(db, current_user.id)