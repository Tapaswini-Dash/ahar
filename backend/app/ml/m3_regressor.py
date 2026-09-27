import torch
from PIL import Image

from app.ml.model_loader import (
    device,
    get_m3_model,
    get_m3_normalization,
)
from app.ml.preprocessing import eval_transform


def predict_portion(image: Image.Image) -> dict:
    """
    M3 predicts a visual serving-weight estimate.

    Raw M3 calories/macros are diagnostic estimates only. Do not store
    them as final nutrition; use INDB, verified external data, or
    user-confirmed ingredients for the logged nutrition.
    """
    model = get_m3_model()

    target_cols, target_mean, target_std = (
        get_m3_normalization()
    )

    input_tensor = (
        eval_transform(image.convert("RGB"))
        .unsqueeze(0)
        .to(device)
    )

    with torch.no_grad():
        normalized_output = model(input_tensor)[0]

    denormalized = (
        normalized_output * target_std
        + target_mean
    )

    denormalized = torch.clamp(
        denormalized,
        min=0,
    )

    values = {
        column: float(value)
        for column, value in zip(
            target_cols,
            denormalized.detach().cpu().tolist(),
        )
    }

    return {
        "mass_grams": round(values["mass"], 1),
        "raw_calories": round(values["calories"], 1),
        "raw_fat_g": round(values["fat"], 1),
        "raw_carb_g": round(values["carb"], 1),
        "raw_protein_g": round(values["protein"], 1),
    }