from app.ml.model_loader import get_label_to_indb_map


def get_indb_mapping(
    m2_label: str,
) -> dict[str, str] | None:
    """
    Return the verified INDB mapping for an M2 label.

    Missing mapping is expected for foods that INDB does not safely
    cover. The caller must use the external/Gemini/manual route.
    """
    mapping = get_label_to_indb_map()
    return mapping.get(m2_label)


def has_verified_indb_mapping(m2_label: str) -> bool:
    return get_indb_mapping(m2_label) is not None