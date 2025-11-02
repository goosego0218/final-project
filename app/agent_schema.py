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
    DESCRIBE = "describe"


class RenderingSpeed(str, Enum):
    FLASH = "FLASH"
    TURBO = "TURBO"
    DEFAULT = "DEFAULT"
    QUALITY = "QUALITY"


class CandidateImage(TypedDict, total=False):
    url: str
    source: str
    variant_id: Optional[str]


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

    # 2. Task routing
    task_type: Literal[
        "generate",
        "edit",
        "remix",
        "replace_bg",
        "describe",
    ]
    input_image_urls: List[str]
    input_mask_url: Optional[str]

    # 3. Prompt planning
    enhanced_prompt: str
    negative_prompt: Optional[str]
    style_tags: Optional[List[str]]
    style_preset: Optional[str]
    style_type: Optional[str]
    rendering_speed: Optional[str]
    aspect_ratio: Optional[str]
    seed: Optional[int]

    # 4. Image results
    candidate_images: List[CandidateImage]
    last_generated_image_url: Optional[str]
    is_image_safe: Optional[bool]

    # 5. Evaluation / feedback
    eval_score: Optional[float]
    eval_feedback: Optional[str]
    human_feedback: Optional[str]
    next_prompt_hint: Optional[str]
    regen_round: int

    # 6. Completion
    done: bool

    # 7. Debug/trace (optional)
    task_reason: Optional[str]  # why router chose this task
    api_endpoint: Optional[str]  # generate|remix|edit|describe
    mask_source: Optional[str]  # upload|canvas|server_sanitized
    mask_size: Optional[List[int]]  # [width, height]
    image_operator_error: Optional[str]


# -------- Node I/O Models (Pydantic) --------


class IntentRouterIn(BaseModel):
    user_text: str
    image_urls: Optional[List[HttpUrl]] = None
    mask_url: Optional[HttpUrl] = None


class IntentRouterOut(BaseModel):
    task_type: TaskType


class PromptPlannerIn(BaseModel):
    brand_name: str
    brand_description: str
    brand_tone: Optional[str] = None
    target_usage: Optional[List[str]] = None
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


# -------- Helpers for routing --------


def choose_task_type(
    text: str, has_image: bool, has_mask: bool, describe_only: bool = False
) -> TaskType:
    """Heuristic intent routing.

    Priority:
    1) explicit describe flag/keywords → describe
    2) presence of mask → edit
    3) image present + mood/variant cues → remix
    4) default → generate
    """
    if describe_only:
        return TaskType.DESCRIBE
    lowered = (text or "").lower()
    describe_keywords = ["describe", "explain", "요약", "설명", "무슨 느낌"]
    remix_keywords = ["remix", "mood", "tone", "variant", "분위기", "톤", "버전"]

    if any(k in lowered for k in describe_keywords):
        return TaskType.DESCRIBE
    if has_mask:
        return TaskType.EDIT
    if has_image and any(k in lowered for k in remix_keywords):
        return TaskType.REMIX
    return TaskType.GENERATE
