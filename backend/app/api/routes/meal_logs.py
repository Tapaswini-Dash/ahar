
"""Routes for confirming an analysis into a real logged meal, logging a
meal manually, and reading/deleting a day's meals."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.schemas.meal_log import (
    ConfirmMealRequest,
    ManualMealLogRequest,
    MealLogOut,
    MealLogUpdateRequest,
)
from app.services import meal_log_service

router = APIRouter(prefix="/meal-logs", tags=["meal-logs"])


@router.post("", response_model=MealLogOut, status_code=status.HTTP_201_CREATED)
async def confirm_meal(
    body: ConfirmMealRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Confirms the items shown on the analysis screen (after the user has
    edited any names/grams) into a real MealLog."""
    try:
        meal = await meal_log_service.create_meal_log_from_confirmed_items(
            db, current_user.id, body
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return meal


@router.post("/manual", response_model=MealLogOut, status_code=status.HTTP_201_CREATED)
async def log_meal_manually(
    body: ManualMealLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Logs a meal the user typed in directly, with no photo/analysis behind it."""
    meal = await meal_log_service.create_manual_meal_log(db, current_user.id, body)
    return meal


@router.get("", response_model=list[MealLogOut])
async def list_meals_for_day(
    log_date: date,
    timezone_offset_minutes: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return await meal_log_service.list_meal_logs_for_day(
        db, current_user.id, log_date, timezone_offset_minutes
    )


@router.delete("/{meal_log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    deleted = await meal_log_service.delete_meal_log(db, current_user.id, meal_log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal log not found")


@router.patch("/{meal_log_id}", response_model=MealLogOut)
async def move_meal_date(
    meal_log_id: int,
    body: MealLogUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if body.logged_at is None:
        raise HTTPException(status_code=422, detail="A new logged_at date is required.")
    meal = await meal_log_service.move_meal_log_date(
        db, current_user.id, meal_log_id, body.logged_at
    )
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal log not found")
    return meal
