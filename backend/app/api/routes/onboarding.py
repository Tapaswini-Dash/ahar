
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.onboarding import OnboardingRequest, UserProfileOut
from app.services import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/profile", response_model=UserProfileOut | None)
async def read_profile(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await onboarding_service.get_profile(db, current_user.id)


@router.put("/profile", response_model=UserProfileOut)
async def write_profile(
    body: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await onboarding_service.save_profile(db, current_user.id, body)
