from pydantic import BaseModel, Field


class GeminiFoodItem(BaseModel):
    name: str
    quantity_description: str
    estimated_mass_g: float | None = Field(
        default=None,
        ge=0,
    )
    confidence: float = Field(
        ge=0,
        le=1,
    )
    needs_confirmation: bool = True


class GeminiFoodAnalysis(BaseModel):
    is_food: bool
    is_multi_item: bool
    scene_description: str
    items: list[GeminiFoodItem]
    rejection_reason: str | None = None