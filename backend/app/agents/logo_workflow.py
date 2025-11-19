from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Literal, Optional
from typing_extensions import TypedDict

from pydantic import BaseModel, HttpUrl, field_validator


class TaskType(str, Enum):
    GENERATE = "generate"
    EDIT = "edit"
    REMIX = "remix"
    REPLACE_BG = "replace_bg"


class RenderingSpeed(str, Enum):
    FLASH = "FLASH"
    TURBO = "TURBO"
    DEFAULT = "DEFAULT"
    QUALITY = "QUALITY"


class CandidateImage(TypedDict, total=False):
    url: str
    source: str
    variant_id: Optional[str]


class ReferenceLogo(TypedDict, total=False):
    image_url: str
    logo_type: Optional[str]
    style_tags: Optional[List[str]]
    source_image: Optional[str]
    notes: Optional[str]


class LogoState(TypedDict, total=False):
    # 0. Request meta
    request_id: str
    created_at: datetime
    updated_at: datetime

    # 1. User requirements / context
    brand_name: str
    brand_description: str
    brand_tone: str
    target_usage: List[str]
    logo_type: Optional[str]
    style_preferences: Optional[List[str]]
    trend_highlights: Optional[List[str]]

    # 2. Task routing
    task_type: Literal[
        "generate",
        "edit",
        "remix",
        "replace_bg",
    ]
    requested_task_type: Optional[str]
    input_image_urls: List[str]
    input_mask_url: Optional[str]
    upload_image_path: Optional[str]
    style_reference_images: Optional[List[str]]
    style_reference_prompt: Optional[str]
    style_reference_urls: Optional[List[str]]
    remix_mode: Optional[str]
    style_ref_mode: Optional[bool]

    # 3. Prompt planning
    # Sidebar/Main prompt inputs
    prompt_keywords: Optional[List[str]]
    user_prompt: Optional[str]
    base_prompt: Optional[str]
    merged_prompt: Optional[str]
    enhanced_prompt: str
    negative_prompt: Optional[str]
    style_tags: Optional[List[str]]
    style_preset: Optional[str]
    style_type: Optional[str]
    rendering_speed: Optional[str]
    aspect_ratio: Optional[str]
    seed: Optional[int]
    remix_strength: Optional[float]
    remix_num_images: Optional[int]
    edit_inpaint_strength: Optional[float]
    edit_keep_background: Optional[bool]

    # 4. Image results
    candidate_images: List[CandidateImage]
    last_generated_image_url: Optional[str]
    is_image_safe: Optional[bool]
    reference_logo: Optional[ReferenceLogo]

     # 5. Evaluation / feedback
    eval_score: Optional[float]
    eval_feedback: Optional[str]
    human_feedback: Optional[str]
    next_prompt_hint: Optional[str]
    safety_notes: Optional[str]
    eval_alignment_score: Optional[int]
    eval_typography_score: Optional[int]
    eval_hangul_score: Optional[int]
    eval_negative_score: Optional[int]
    eval_layout_score: Optional[int]
    eval_feedback_score: Optional[int]
    regen_round: int
    regen_history: Optional[List[Dict[str, str]]]

    # 6. Completion
    done: bool

    # 7. Debug/trace (optional)
    task_reason: Optional[str]  # why router chose this task
    api_endpoint: Optional[str]  # generate|remix|edit
    mask_source: Optional[str]  # upload|canvas|server_sanitized
    mask_size: Optional[List[int]]  # [width, height]
    image_operator_error: Optional[str]


class PromptPlannerIn(BaseModel):
    brand_name: str
    brand_description: str
    brand_tone: Optional[str] = None
    target_usage: Optional[List[str]] = None
    logo_type: Optional[str] = None
    style_preferences: Optional[List[str]] = None
    # Sidebar + main prompt inputs
    prompt_keywords: Optional[List[str]] = None
    user_prompt: Optional[str] = None
    base_prompt: Optional[str] = None
    human_feedback: Optional[str] = None
    eval_feedback: Optional[str] = None


class PromptPlannerOut(BaseModel):
    enhanced_prompt: str
    negative_prompt: Optional[str] = None
    style_tags: Optional[List[str]] = None
    style_preset: Optional[str] = None
    rendering_speed: Optional[RenderingSpeed] = None
    aspect_ratio: Optional[str] = None
    seed: Optional[int] = None

    @field_validator("aspect_ratio")
    @classmethod
    def _validate_ratio(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if ":" not in v:
            raise ValueError("aspect_ratio must be like '1:1' or '3:4'")
        return v


class ImageOperatorIn(BaseModel):
    task_type: TaskType
    prompt: str
    negative_prompt: Optional[str] = None
    aspect_ratio: Optional[str] = None
    style_preset: Optional[str] = None
    rendering_speed: Optional[RenderingSpeed] = None
    seed: Optional[int] = None
    input_image_urls: Optional[List[HttpUrl]] = None
    input_mask_url: Optional[HttpUrl] = None


class ImageOperatorOut(BaseModel):
    candidate_images: List[CandidateImage]
    last_generated_image_url: Optional[str] = None
    is_image_safe: Optional[bool] = None


class EvaluatorIn(BaseModel):
    image_url: HttpUrl
    brand_description: Optional[str] = None
    brand_tone: Optional[str] = None
    human_feedback: Optional[str] = None


class EvaluatorOut(BaseModel):
    eval_score: float
    eval_feedback: str
    next_prompt_hint: Optional[str] = None
    need_regen: bool = False


class ResultPackagerOut(BaseModel):
    done: bool
    chosen_image_url: Optional[HttpUrl] = None
    history: Dict[str, str] | None = None





