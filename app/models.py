from typing import Optional, TypedDict

from pydantic import BaseModel


class LogoRequest(BaseModel):
    brand_name: str
    description: str
    style: str = "minimal, clean, flat design"
    negative_prompt: Optional[str] = None
    reference_images: Optional[list[str]] = None
    edit_image_url: Optional[str] = None
    edit_instruction: Optional[str] = None
    seed: Optional[int] = None
    style_type: Optional[str] = None
    cfg_scale: float = 15.0
    base_prompt: Optional[str] = None


class LogoState(TypedDict, total=False):
    brand_name: str
    description: str
    style: str
    prompt: str
    base_prompt: str
    image_url: str
    original_path: str
    overlay_path: str
    edit_image_url: Optional[str]
    edit_instruction: Optional[str]
    negative_prompt: Optional[str]
    reference_images: Optional[list[str]]
    style_type: Optional[str]
    seed: Optional[int]
    cfg_scale: float
