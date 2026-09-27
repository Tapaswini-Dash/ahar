from PIL import Image

from app.ml.m2_classifier import predict_food
from app.ml.m3_regressor import predict_portion


M2_HIGH_CONFIDENCE = 0.70
M2_LOW_CONFIDENCE = 0.40


def run_vision_pipeline(
    image: Image.Image,
    top_k: int = 3,
) -> dict:
    m2_result = predict_food(
        image=image,
        top_k=top_k,
    )

    m3_result = predict_portion(
        image=image,
    )

    confidence = float(m2_result["confidence"])

    if confidence >= M2_HIGH_CONFIDENCE:
        decision = "local_candidate"
    elif confidence >= M2_LOW_CONFIDENCE:
        decision = "gemini_verify"
    else:
        decision = "gemini_fallback"

    return {
        "top_label": m2_result["top_label"],
        "confidence": m2_result["confidence"],
        "top_predictions": m2_result["top_predictions"],
        "estimated_mass_grams": m3_result["mass_grams"],
        "m3_debug_estimate": {
            "raw_calories": m3_result["raw_calories"],
            "raw_fat_g": m3_result["raw_fat_g"],
            "raw_carb_g": m3_result["raw_carb_g"],
            "raw_protein_g": m3_result["raw_protein_g"],
        },
        "decision": {
            "status": decision,
            "needs_gemini": decision != "local_candidate",
            "needs_user_confirmation": True,
            "reason": (
                "M2 confidence is below the automatic-trust threshold."
                if decision != "local_candidate"
                else "M2 produced a high-confidence candidate."
            ),
        },
    }