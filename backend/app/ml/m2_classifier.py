import torch
from PIL import Image

from app.ml.model_loader import (
    device,
    get_m2_class_names,
    get_m2_model,
)
from app.ml.preprocessing import eval_transform


def predict_food(
    image: Image.Image,
    top_k: int = 3,
) -> dict:
    model = get_m2_model()
    class_names = get_m2_class_names()

    input_tensor = (
        eval_transform(image.convert("RGB"))
        .unsqueeze(0)
        .to(device)
    )

    with torch.no_grad():
        logits = model(input_tensor)
        probabilities = torch.softmax(logits, dim=1)[0]

    k = min(max(1, int(top_k)), len(probabilities))

    top_probs, top_indices = torch.topk(
        probabilities,
        k=k,
    )

    top_predictions = [
        {
            "label": class_names[int(index.item())],
            "confidence": round(
                float(probability.item()),
                4,
            ),
        }
        for probability, index in zip(
            top_probs.cpu(),
            top_indices.cpu(),
        )
    ]

    return {
        "top_label": top_predictions[0]["label"],
        "confidence": top_predictions[0]["confidence"],
        "top_predictions": top_predictions,
    }