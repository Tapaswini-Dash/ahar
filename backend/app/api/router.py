import io
import json
import logging
from typing import Annotated
from app.api.routes.gamification import router as gamification_router
from app.api.routes.food_analysis import router as food_analysis_router
from app.api.routes.assistant import router as assistant_router
from app.api.routes.packaged_food import router as packaged_food_router
from app.api.routes.reminder import router as reminder_router

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)
from PIL import Image
from pydantic import BaseModel, Field
from app.api.routes.meal_logs import router as meal_logs_router

from app.ml.inference_pipeline import run_vision_pipeline
from app.ml.model_loader import (
    get_label_to_indb_map,
    get_m2_class_names,
    get_m3_normalization,
)
from app.services.gemini_service import (
    analyze_food_image as analyze_with_gemini,
)
from app.services.nutrition_service import estimate_nutrition
from app.api.routes.auth import router as auth_router
from app.api.routes.onboarding import router as onboarding_router

logger = logging.getLogger(__name__)


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(meal_logs_router)
api_router.include_router(onboarding_router)
api_router.include_router(food_analysis_router)
api_router.include_router(gamification_router)
api_router.include_router(assistant_router)
api_router.include_router(packaged_food_router)
api_router.include_router(reminder_router)
def is_gemini_unavailable(exc: Exception) -> bool:
    """True for temporary Gemini failures (overload, rate limit, 5xx)."""
    if getattr(exc, "status_code", None) in {429, 500, 502, 503, 504}:
        return True
    text = str(exc).upper()
    return any(
        marker in text
        for marker in ("503", "UNAVAILABLE", "HIGH DEMAND", "RESOURCE_EXHAUSTED")
    )


class NutritionItem(BaseModel):
    name: str = Field(min_length=1)
    grams: float = Field(gt=0, le=5000)


class NutritionRequest(BaseModel):
    items: list[NutritionItem] = Field(min_length=1, max_length=30)


class IngredientBreakdownRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    grams: float = Field(gt=0, le=5000)


@api_router.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "message": "Ahar API is running.",
        "models_loaded": True,
    }


@api_router.get("/ml/status")
async def ml_status() -> dict:
    m2_classes = get_m2_class_names()
    m3_targets, _, _ = get_m3_normalization()
    mapping = get_label_to_indb_map()

    return {
        "m2": {
            "num_classes": len(m2_classes),
            "first_10": [
                m2_classes[i]
                for i in range(min(10, len(m2_classes)))
            ],
            "last_10": [
                m2_classes[i]
                for i in range(
                    max(0, len(m2_classes) - 10),
                    len(m2_classes),
                )
            ],
        },
        "m3": {
            "targets": m3_targets,
        },
        "label_to_indb": {
            "num_verified": len(mapping),
            "labels": list(mapping.keys()),
        },
    }


@api_router.get("/ml/gemini-status")
async def gemini_status() -> dict:
    from app.core.config import settings

    return {
        "configured": bool(settings.gemini_api_key),
        "model": settings.gemini_model,
    }


@api_router.post("/food/gemini-test")
async def gemini_test(
    image: UploadFile = File(...),
) -> dict:
    image_bytes = await image.read()

    try:
        result = analyze_with_gemini(
            image_bytes=image_bytes,
            mime_type=image.content_type or "image/jpeg",
            m2_candidates=[],
            yolo_detections=[],
        )
    except Exception as exc:
        logger.exception("Gemini test failed")

        if is_gemini_unavailable(exc):
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "gemini_temporarily_unavailable",
                    "message": (
                        "Gemini is temporarily busy. "
                        "Please retry in a moment."
                    ),
                },
            ) from exc

        raise HTTPException(
            status_code=502,
            detail={
                "code": "gemini_request_failed",
                "message": "Gemini analysis failed.",
            },
        ) from exc

    return result.model_dump()


@api_router.post("/food/estimate-nutrition")
async def estimate_nutrition_endpoint(
    body: NutritionRequest,
) -> dict:
    """Recalculate nutrition after the user edits names/grams."""
    return estimate_nutrition(
        [item.model_dump() for item in body.items]
    )


@api_router.post("/food/breakdown-ingredients")
async def breakdown_ingredients(body: IngredientBreakdownRequest) -> dict:
    """Optional recipe breakdown; nutrition is resolved normally after review."""
    from google import genai
    from google.genai import types
    from app.core.config import settings

    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="Ingredient breakdown is not configured.")
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = (f"Break down one serving of {body.name} weighing {body.grams:g} grams into its common calorie-bearing recipe ingredients. "
              'Return JSON only: {"items":[{"name":"...","grams":0}]}. Make positive ingredient weights sum to the serving weight. Omit water and garnishes.')
    last_error = None
    for model_name in settings.gemini_model_list:
        try:
            response = client.models.generate_content(model=model_name, contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1, max_output_tokens=300))
            items = json.loads(response.text or "{}").get("items", [])
            if not items or len(items) > 12 or any(not item.get("name") or float(item.get("grams", 0)) <= 0 for item in items):
                raise ValueError("Ingredient breakdown response was incomplete.")
            scale = body.grams / sum(float(item["grams"]) for item in items)
            return {"items": [{"name": str(item["name"])[:255], "grams": round(float(item["grams"]) * scale, 1)} for item in items]}
        except Exception as exc:
            last_error = exc
            logger.warning("Ingredient breakdown model %s failed: %s", model_name, exc)
    raise HTTPException(status_code=502, detail="Could not break down this food. Try again or add ingredients manually.") from last_error


@api_router.post("/food/analyze-image")
async def analyze_image(
    image: Annotated[UploadFile, File()],
) -> dict:
    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    try:
        pil_image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image.",
        ) from exc

    local_result = run_vision_pipeline(
        image=pil_image,
        top_k=3,
    )

    if not local_result["decision"]["needs_gemini"]:
        return {
            "source": "m2_m3_pending_confirmation",
            "local_analysis": local_result,
            "gemini_analysis": None,
        }

    try:
        gemini_result = analyze_with_gemini(
            image_bytes=image_bytes,
            mime_type=image.content_type or "image/jpeg",
            m2_candidates=local_result["top_predictions"],
            yolo_detections=[],
        )
    except Exception as exc:
        logger.exception("Gemini image analysis failed")

        if is_gemini_unavailable(exc):
            return {
                "source": "local_fallback",
                "local_analysis": local_result,
                "gemini_analysis": None,
                "confirmation_required": True,
                "fallback": {
                    "code": "gemini_temporarily_unavailable",
                    "message": (
                        "Gemini is temporarily unavailable. "
                        "Please confirm or edit the detected food manually."
                    ),
                },
            }

        raise HTTPException(
            status_code=502,
            detail={
                "code": "gemini_request_failed",
                "message": "Gemini analysis failed.",
            },
        ) from exc

    gemini_data = gemini_result.model_dump()

    # Nutrition must never break the response: if it fails, the user
    # still gets the detected items and can retry via /food/estimate-nutrition.
    nutrition = None
    if gemini_data.get("is_food") and gemini_data.get("items"):
        try:
            nutrition = estimate_nutrition(gemini_data["items"])
        except Exception:
            logger.exception("Nutrition estimation failed")

    return {
        "source": "gemini_verification",
        "local_analysis": local_result,
        "gemini_analysis": gemini_data,
        "nutrition": nutrition,
    }
