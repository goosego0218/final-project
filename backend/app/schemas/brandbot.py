"""Brandbot API용 Pydantic 스키마."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BrandbotSessionCreateRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="재사용하거나 초기화할 세션 ID")
    reset: bool = Field(False, description="기존 세션을 강제로 리셋할지 여부")


class BrandbotMessageRequest(BaseModel):
    message: str = Field(..., description="사용자 발화 텍스트")


class BrandbotState(BaseModel):
    session_id: str
    intent: Optional[str] = None
    snapshot_text: Optional[str] = None
    brand_draft: Dict[str, Any] = Field(default_factory=dict)
    brand_profile: Dict[str, Any] = Field(default_factory=dict)
    brand_strategy: Dict[str, Any] = Field(default_factory=dict)
    trend_recos: Dict[str, Any] = Field(default_factory=dict)
    confirmed: bool = False
    project_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: List[Dict[str, Any]] = Field(default_factory=list)


class BrandbotSessionResponse(BaseModel):
    state: BrandbotState


BrandbotMessageResponse = BrandbotSessionResponse

