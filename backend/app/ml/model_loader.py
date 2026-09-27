import json
import logging
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models

from app.core.config import settings


logger = logging.getLogger(__name__)

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

M2_CHECKPOINT_FILENAME = "food_classifier_v2_best.pt"
M2_CLASSES_FILENAME = "m2_classes.json"

M3_CHECKPOINT_FILENAME = "nutrition_regressor_huber_best.pt"
M3_METADATA_FILENAME = "m3_normalization.json"

LABEL_TO_INDB_FILENAME = "m2_label_to_indb.json"

_m2_model: nn.Module | None = None
_m2_class_names: dict[int, str] | None = None

_m3_model: nn.Module | None = None
_m3_target_cols: list[str] | None = None
_m3_target_mean: torch.Tensor | None = None
_m3_target_std: torch.Tensor | None = None

_label_to_indb: dict[str, dict[str, str]] | None = None


def _artifacts_dir() -> Path:
    return Path(settings.model_artifacts_dir)


def _require_file(filename: str) -> Path:
    path = _artifacts_dir() / filename

    if not path.is_file():
        raise FileNotFoundError(
            f"Required ML artifact not found:\n{path}\n\n"
            "Put the required checkpoint/JSON file in:\n"
            f"{_artifacts_dir()}"
        )

    return path


def _build_efficientnet_b0(num_outputs: int) -> nn.Module:
    model = models.efficientnet_b0(weights=None)

    model.classifier[1] = nn.Linear(
        model.classifier[1].in_features,
        num_outputs,
    )

    return model


def _load_state_dict(checkpoint_path: Path) -> dict:
    loaded = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=True,
    )

    if not isinstance(loaded, dict):
        raise TypeError(
            f"Checkpoint is not a state_dict dictionary: {checkpoint_path}"
        )

    return loaded.get("model_state_dict", loaded)


def _load_m2() -> None:
    global _m2_model, _m2_class_names

    checkpoint_path = _require_file(M2_CHECKPOINT_FILENAME)
    classes_path = _require_file(M2_CLASSES_FILENAME)

    with classes_path.open("r", encoding="utf-8") as file:
        raw_classes = json.load(file)

    if isinstance(raw_classes, list):
        _m2_class_names = {
            index: str(label)
            for index, label in enumerate(raw_classes)
        }
    elif isinstance(raw_classes, dict):
        _m2_class_names = {
            int(index): str(label)
            for index, label in raw_classes.items()
        }
    else:
        raise TypeError(
            "m2_classes.json must contain a JSON list or object."
        )

    num_classes = len(_m2_class_names)

    if num_classes == 0:
        raise ValueError("m2_classes.json contains no labels.")

    model = _build_efficientnet_b0(num_classes)
    model.load_state_dict(_load_state_dict(checkpoint_path))
    model.to(device)
    model.eval()

    _m2_model = model

    logger.info(
        "M2 loaded successfully: %d classes, device=%s",
        num_classes,
        device,
    )


def _metadata_values(
    metadata: dict,
    target_cols: list[str],
    key: str,
) -> list[float]:
    raw_values = metadata.get(key)

    if isinstance(raw_values, list):
        if len(raw_values) != len(target_cols):
            raise ValueError(
                f"{key} must have {len(target_cols)} values, "
                f"but has {len(raw_values)}."
            )
        return [float(value) for value in raw_values]

    if isinstance(raw_values, dict):
        return [
            float(raw_values[column])
            for column in target_cols
        ]

    raise TypeError(
        f"{key} in M3 metadata must be a list or dictionary."
    )


def _load_m3() -> None:
    global _m3_model
    global _m3_target_cols
    global _m3_target_mean
    global _m3_target_std

    checkpoint_path = _require_file(M3_CHECKPOINT_FILENAME)
    metadata_path = _require_file(M3_METADATA_FILENAME)

    with metadata_path.open("r", encoding="utf-8") as file:
        metadata = json.load(file)

    _m3_target_cols = (
        metadata.get("target_columns")
        or metadata.get("target_cols")
    )

    if not isinstance(_m3_target_cols, list):
        raise TypeError(
            "M3 metadata must contain target_columns as a list."
        )

    expected_order = [
        "calories",
        "mass",
        "fat",
        "carb",
        "protein",
    ]

    if _m3_target_cols != expected_order:
        raise ValueError(
            "Unexpected M3 output order.\n"
            f"Expected: {expected_order}\n"
            f"Found:    {_m3_target_cols}"
        )

    mean_values = _metadata_values(
        metadata,
        _m3_target_cols,
        "target_mean",
    )

    std_values = _metadata_values(
        metadata,
        _m3_target_cols,
        "target_std",
    )

    _m3_target_mean = torch.tensor(
        mean_values,
        dtype=torch.float32,
        device=device,
    )

    _m3_target_std = torch.tensor(
        std_values,
        dtype=torch.float32,
        device=device,
    )

    model = _build_efficientnet_b0(len(_m3_target_cols))
    model.load_state_dict(_load_state_dict(checkpoint_path))
    model.to(device)
    model.eval()

    _m3_model = model

    logger.info(
        "M3 loaded successfully: targets=%s, device=%s",
        _m3_target_cols,
        device,
    )


def _load_label_mapping() -> None:
    global _label_to_indb

    mapping_path = _require_file(
        LABEL_TO_INDB_FILENAME
    )

    with mapping_path.open("r", encoding="utf-8") as file:
        loaded_mapping = json.load(file)

    if not isinstance(loaded_mapping, dict):
        raise TypeError(
            "m2_label_to_indb.json must contain a JSON object."
        )

    _label_to_indb = loaded_mapping

    logger.info(
        "Loaded %d verified M2-to-INDB mappings.",
        len(_label_to_indb),
    )


def load_models() -> None:
    _load_m2()
    _load_m3()
    _load_label_mapping()


def get_m2_model() -> nn.Module:
    if _m2_model is None:
        raise RuntimeError(
            "M2 model is not loaded. Run load_models() at startup."
        )
    return _m2_model


def get_m2_class_names() -> dict[int, str]:
    if _m2_class_names is None:
        raise RuntimeError(
            "M2 class names are not loaded. Run load_models() at startup."
        )
    return _m2_class_names


def get_m3_model() -> nn.Module:
    if _m3_model is None:
        raise RuntimeError(
            "M3 model is not loaded. Run load_models() at startup."
        )
    return _m3_model


def get_m3_normalization() -> tuple[
    list[str],
    torch.Tensor,
    torch.Tensor,
]:
    if (
        _m3_target_cols is None
        or _m3_target_mean is None
        or _m3_target_std is None
    ):
        raise RuntimeError(
            "M3 metadata is not loaded. Run load_models() at startup."
        )

    return (
        _m3_target_cols,
        _m3_target_mean,
        _m3_target_std,
    )


def get_label_to_indb_map() -> dict[str, dict[str, str]]:
    if _label_to_indb is None:
        raise RuntimeError(
            "M2-to-INDB mapping is not loaded. Run load_models() at startup."
        )
    return _label_to_indb