
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.packaged_food import (
    BrandSuggestion,
    PackagedFoodLogCreate,
    PackagedFoodLogOut,
    PackagedFoodLookupResult,
    PackagedLabelRead,
)
from app.services import packaged_food_service
from app.services import packaged_label_service
from app.services.onboarding_service import get_profile

router = APIRouter(prefix="/packaged-food", tags=["packaged-food"])


@router.post("/read-label", response_model=PackagedLabelRead)
async def read_label(image: UploadFile = File(...), current_user=Depends(get_current_active_user)):
    mime_type = image.content_type or ""
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP label photo.")
    image_bytes = await image.read(8 * 1024 * 1024 + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded label photo is empty.")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The label photo must be smaller than 8 MB.")
    try:
        return packaged_label_service.read_packaged_label(image_bytes, mime_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Could not read that label clearly. Try a sharper, well-lit photo.") from exc


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
    try:
        return await packaged_food_service.log_packaged_food(db, current_user.id, body)
    except packaged_food_service.DuplicatePackagedFood as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_product",
                "message": "You already logged this product on that date.",
                "existing": {
                    "logged_at": exc.existing.logged_at.isoformat(),
                    "servings_consumed": exc.existing.servings_consumed,
                },
            },
        ) from exc


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
