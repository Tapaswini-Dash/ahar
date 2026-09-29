"""Transcribe packaged-food labels without estimating missing nutrition."""

from __future__ import annotations

import json

from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.packaged_food import PackagedLabelRead


LABEL_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "product_name": {"type": "STRING", "nullable": True},
        "brand": {"type": "STRING", "nullable": True},
        "barcode": {"type": "STRING", "nullable": True},
        "serving_size_grams": {"type": "NUMBER", "nullable": True},
        "nutrition_basis": {"type": "STRING", "enum": ["per_100g", "per_serving"]},
        "calories": {"type": "NUMBER", "nullable": True},
        "protein_g": {"type": "NUMBER", "nullable": True},
        "carbs_g": {"type": "NUMBER", "nullable": True},
        "fat_g": {"type": "NUMBER", "nullable": True},
        "ingredients_text": {"type": "STRING", "nullable": True},
        "needs_review": {"type": "BOOLEAN"},
    },
    "required": [
        "product_name", "brand", "barcode", "serving_size_grams",
        "nutrition_basis", "calories", "protein_g", "carbs_g", "fat_g",
        "ingredients_text", "needs_review",
    ],
}


def read_packaged_label(image_bytes: bytes, mime_type: str) -> PackagedLabelRead:
    if not settings.gemini_api_key:
        raise RuntimeError("Label photo reading needs GEMINI_API_KEY configured in backend/.env.")

    prompt = """Read the packaged food label in this photo and transcribe only information that is visibly printed.
Return JSON matching the schema. This is label OCR, not a nutrition estimate.
- Read the product name, brand and barcode only when legible.
- Copy the ingredients list as printed; do not add or infer ingredients.
- Transcribe energy in kcal and protein, carbohydrate and fat in grams.
- Set nutrition_basis to per_100g or per_serving according to the printed nutrition panel.
- If the basis, serving weight, or any value is unclear, return null for that field.
- Never calculate missing nutrition from the ingredients.
- Set needs_review=true because a person must verify OCR before logging."""

    client = genai.Client(api_key=settings.gemini_api_key)
    last_exception = None
    for model_name in settings.gemini_model_list:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type), prompt],
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_schema=LABEL_SCHEMA,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
            if not response.text:
                raise RuntimeError("No readable label details were found in that photo.")
            return PackagedLabelRead.model_validate(json.loads(response.text))
        except Exception as exc:
            last_exception = exc
            text = str(exc).upper()
            if getattr(exc, "status_code", None) in {429, 500, 502, 503, 504} or any(
                marker in text for marker in ("UNAVAILABLE", "HIGH DEMAND", "RESOURCE_EXHAUSTED", "TIMEOUT")
            ):
                continue
            raise
    if last_exception:
        raise last_exception
    raise RuntimeError("Label reading failed.")
