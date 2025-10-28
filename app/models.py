from typing import Any, Optional, TypedDict

from pydantic import BaseModel
from typing_extensions import Annotated
from langgraph.channels import Topic


class PromptHistoryEntry(TypedDict, total=False):
    stage: str
    prompt: str
    edit_instruction: Optional[str]


class LogoRequest(BaseModel):
    brand_name: str
    description: str
    style: str = "minimal, clean, flat design"
    negative_prompt: Optional[str] = None
    reference_images: Optional[list[str]] = None
    character_reference_images: Optional[list[str]] = None
    edit_image_url: Optional[str] = None
    edit_instruction: Optional[str] = None
    seed: Optional[int] = None
    style_type: Optional[str] = None
    cfg_scale: float = 15.0
    base_prompt: Optional[str] = None
    skip_prompt_refine: bool = False
    image_weight: Optional[int] = None
    color_palette: Optional[dict[str, Any]] = None
    enable_palette_suggestion: bool = True
    auto_retry_remix: bool = True
    remix_max_retries: int = 1


class LogoState(TypedDict, total=False):
    brand_name: str
    description: str
    style: str
    prompt: str
    base_prompt: str
    image_url: str
    original_path: str
    overlay_path: str
    prompt_history: Annotated[list[PromptHistoryEntry], Topic(PromptHistoryEntry, accumulate=True)]
    edit_image_url: Optional[str]
    edit_instruction: Optional[str]
    negative_prompt: Optional[str]
    reference_images: Optional[list[str]]
    character_reference_images: Optional[list[str]]
    style_type: Optional[str]
    seed: Optional[int]
    cfg_scale: float
    skip_prompt_refine: bool
    image_weight: Optional[int]
    color_palette: Optional[dict[str, Any]]
    enable_palette_suggestion: bool
    auto_retry_remix: bool
    needs_retry: bool
    remix_attempts: int
    remix_max_retries: int
