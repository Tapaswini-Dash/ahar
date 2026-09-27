
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.packaged_food import (
    BrandSuggestion,
    PackagedFoodLogCreate,
    PackagedFoodLogOut,
    PackagedFoodLookupResult,
)
from app.services import packaged_food_service
from app.services.onboarding_service import get_profile

router = APIRouter(prefix="/packaged-food", tags=["packaged-food"])


@router.get("/lookup/{barcode}", response_model=PackagedFoodLookupResult)
async def lookup_barcode(barcode: str):
    try:
        result = await packaged_food_service.lookup_barcode(barcode)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found or missing nutrition data.")
    return result


@router.post("/logs", response_model=PackagedFoodLogOut, status_code=201)
async def log_packaged_food(
    body: PackagedFoodLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await packaged_food_service.log_packaged_food(db, current_user.id, body)


@router.get("/suggestions", response_model=list[BrandSuggestion])
async def suggest_brands(
    query: str = Query(min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    profile = await get_profile(db, current_user.id)
    try:
        return await packaged_food_service.suggest_brands(
            query,
            diet_preference=getattr(profile, "diet_preference", None),
            goal=getattr(profile, "goal", None),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
