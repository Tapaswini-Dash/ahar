import json

from google import genai
from google.genai import types

from app.core.config import settings
from app.services.gemini_schemas import GeminiFoodAnalysis


GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "is_food": {
            "type": "BOOLEAN",
        },
        "is_multi_item": {
            "type": "BOOLEAN",
        },
        "scene_description": {
            "type": "STRING",
        },
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {
                        "type": "STRING",
                    },
                    "quantity_description": {
                        "type": "STRING",
                    },
                    "estimated_mass_g": {
                        "type": "NUMBER",
                        "nullable": True,
                    },
                    "confidence": {
                        "type": "NUMBER",
                    },
                    "needs_confirmation": {
                        "type": "BOOLEAN",
                    },
                },
                "required": [
                    "name",
                    "quantity_description",
                    "confidence",
                    "needs_confirmation",
                ],
            },
        },
        "rejection_reason": {
            "type": "STRING",
            "nullable": True,
        },
    },
    "required": [
        "is_food",
        "is_multi_item",
        "scene_description",
        "items",
        "rejection_reason",
    ],
}


def analyze_food_image(
    image_bytes: bytes,
    mime_type: str,
    m2_candidates: list[dict],
    yolo_detections: list[dict] | None = None,
) -> GeminiFoodAnalysis:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing from backend/.env"
        )

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    context = {
        "m2_candidates": m2_candidates,
        "yolo_detections": yolo_detections or [],
    }

    prompt = f"""
Analyze this image for a nutrition-tracking application.

Classifier and detector context:
{json.dumps(context, ensure_ascii=False)}

Return JSON only.

Rules:
- Set is_food=false and items=[] if no food is visible.
- Identify every distinct visible food or drink.
- Treat sauces, dips, chutneys, rice, breads, curries, fries,
  and drinks as separate items when visibly distinct.
- Set is_multi_item=true for two or more distinct food items.
- Do not invent hidden ingredients.
- Every item must have needs_confirmation=true.
"""

    last_exception: Exception | None = None

    for model_name in settings.gemini_model_list:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=GEMINI_SCHEMA,
                    automatic_function_calling=(
                        types.AutomaticFunctionCallingConfig(
                            disable=True,
                        )
                    ),
                ),
            )

            if not response.text:
                raise RuntimeError(
                    "Gemini returned an empty response."
                )

            return GeminiFoodAnalysis.model_validate(
                json.loads(response.text)
            )

        except Exception as exc:
            last_exception = exc

            status_code = getattr(
                exc,
                "status_code",
                None,
            )

            error_text = str(exc).upper()

            temporary_error = (
                status_code in {500, 502, 503, 504}
                or "UNAVAILABLE" in error_text
                or "HIGH DEMAND" in error_text
                or "BAD GATEWAY" in error_text
                or "TIMEOUT" in error_text
            )

            if temporary_error:
                continue

            raise

    if last_exception is not None:
        raise last_exception

    raise RuntimeError(
        "Gemini analysis failed without an exception."
    )