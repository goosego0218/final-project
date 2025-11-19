from typing import Optional, List

from pydantic import BaseModel


class ReferenceLogoPayload(BaseModel):
    image_url: str
    logo_type: Optional[str] = None
    style_tags: Optional[List[str]] = None
    source_image: Optional[str] = None
    notes: Optional[str] = None


class LogoRequest(BaseModel):
    brand_name: str
    description: str
    style: str = "minimal, clean, flat design"
    negative_prompt: Optional[str] = None
    # Sidebar/Main prompt inputs (optional)
    prompt_keywords: Optional[list[str]] = None
    user_prompt: Optional[str] = None
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
    image_task_mode: Optional[str] = None  # Pick "remix", "edit", or "replace_bg" for Ideogram mode
    remix_strength: Optional[float] = None
    remix_num_images: Optional[int] = None
    edit_inpaint_strength: Optional[float] = None
    edit_keep_background: Optional[bool] = None
    target_usage: Optional[List[str]] = None
    logo_type: Optional[str] = None
    style_preferences: Optional[List[str]] = None
    trend_highlights: Optional[List[str]] = None
    reference_logo: Optional[ReferenceLogoPayload] = None



# v1 state definitions removed; v2 uses app.agents.logo_workflow.LogoState
