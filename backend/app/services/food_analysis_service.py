"""
The real analyze-image pipeline:
  1. Image quality check (reject obviously bad photos before spending model/API time)
  2. run_vision_pipeline (M2 + M3, whole image — no real per-item cropping
     exists; see FoodAnalysis model's docstring for why)
  3. decision.needs_gemini (computed by inference_pipeline.py) decides
     whether Gemini identifies the item(s) itself — Gemini IS the real
     "multi-item detector" here, not a pixel cropper
  4. INDB nutrition resolution per confirmed item name (nutrition_service)
  5. Returns a clean result for the confirmation screen — caller (route)
     persists this as a FoodAnalysis draft row.
"""

from __future__ import annotations

import io

from PIL import Image

from app.ml.inference_pipeline import run_vision_pipeline
from app.services.gemini_service import analyze_food_image as analyze_with_gemini
from app.services.nutrition_service import estimate_nutrition
from app.utils.image_validation import check_image_quality


def _is_gemini_unavailable(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) in {429, 500, 502, 503, 504}:
        return True
    text = str(exc).upper()
    return any(m in text for m in ("503", "UNAVAILABLE", "HIGH DEMAND", "RESOURCE_EXHAUSTED"))


def analyze_image_bytes(image_bytes: bytes, mime_type: str) -> dict:
    if not image_bytes:
        return {"error": "empty_image", "message": "Uploaded image is empty."}

    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return {"error": "invalid_image", "message": "Uploaded file is not a valid image."}

    quality = check_image_quality(pil_image)
    if not quality["passed"]:
        return {
            "error": "poor_image_quality",
            "message": "Please retake the photo: " + " ".join(quality["issues"]),
            "issues": quality["issues"],
        }

    local_result = run_vision_pipeline(image=pil_image, top_k=3)

    # M2 confident enough on its own — skip Gemini entirely.
    if not local_result["decision"]["needs_gemini"]:
        item_name = local_result["top_label"]
        estimated_grams = local_result["estimated_mass_grams"]
        nutrition = estimate_nutrition([{"name": item_name, "grams": estimated_grams}])
        return {
            "pipeline_stage": "local_confident",
            "items": [{"name": item_name, "estimated_mass_g": estimated_grams, "source": "M2"}],
            "nutrition": nutrition,
        }

    # Low/medium local confidence — let Gemini identify item(s), single or multi.
    try:
        gemini_result = analyze_with_gemini(
            image_bytes=image_bytes,
            mime_type=mime_type,
            m2_candidates=local_result["top_predictions"],
            yolo_detections=[],
        )
    except Exception as exc:
        if _is_gemini_unavailable(exc):
            return {
                "error": "gemini_unavailable",
                "message": "Detection is temporarily unavailable. Please confirm the item manually.",
                "local_candidates": local_result["top_predictions"],
            }
        raise

    gemini_data = gemini_result.model_dump()
    if not gemini_data.get("is_food") or not gemini_data.get("items"):
        return {"error": "no_food_detected", "message": "No food was recognized in this photo."}

    items_for_nutrition = [
        {"name": item["name"], "grams": item.get("estimated_mass_g") or 100}
        for item in gemini_data["items"]
    ]
    nutrition = estimate_nutrition(items_for_nutrition)

    return {
        "pipeline_stage": "gemini_multi_item" if len(gemini_data["items"]) > 1 else "gemini_single_item",
        "items": gemini_data["items"],
        "nutrition": nutrition,
    }