
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.services import food_analysis_service
from app.services.onboarding_service import get_profile

router = APIRouter(prefix="/food-analyses", tags=["food-analysis"])


@router.post("")
async def analyze_image(
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> dict:
    image_bytes = await image.read()
    result = food_analysis_service.analyze_image_bytes(
        image_bytes, image.content_type or "image/jpeg"
    )
    if "error" in result:
        raise HTTPException(status_code=422, detail=result)

    profile = await get_profile(db, current_user.id)
    if profile:
        result["advisories"] = nutrition_assistant_service.build_advisories(result["items"], profile)
        result["goal_swaps"] = nutrition_assistant_service.suggest_goal_swaps(result["items"], profile)

    return result