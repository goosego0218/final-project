from typing import Optional

from pydantic import BaseModel


class LogoRequest(BaseModel):
    brand_name: str
    description: str
    style: str = "minimal, clean, flat design"
    negative_prompt: Optional[str] = None
    reference_images: Optional[list[str]] = None
    character_reference_images: Optional[list[str]] = None
    edit_image_url: Optional[str] = None
    mask_image_url: Optional[str] = None
    edit_instruction: Optional[str] = None
    seed: Optional[int] = None
    style_type: Optional[str] = None
    cfg_scale: float = 15.0
    base_prompt: Optional[str] = None
    skip_prompt_refine: bool = False
    image_weight: Optional[int] = None
    auto_retry_remix: bool = True
    remix_max_retries: int = 1


# v1 state definitions removed; v2 uses app.agent_schema.LogoState
