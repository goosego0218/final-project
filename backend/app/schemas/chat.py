# 채팅 API용 Pydantic 스키마
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성 

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ChatSessionCreateRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="재사용할 세션 ID (없으면 새로 생성)")

class ChatMessageRequest(BaseModel):
    message: str = Field(..., description="사용자 발화 텍스트")

class ChatState(BaseModel):
    """채팅 세션의 상태 정보"""
    session_id: str = Field(..., description="세션 고유 식별자")
    current_intent: Optional[str] = Field(None, description="현재 대화 의도 (collect, trend, confirm 등)")
    brand_summary_text: Optional[str] = Field(None, description="브랜드 정보 요약 텍스트 (사용자에게 표시용)")
    collecting_brand_information: Dict[str, Any] = Field(default_factory=dict, description="브랜드 정보 초안 (대화를 통해 수집 중인 데이터)")
    brand_profile: Dict[str, Any] = Field(default_factory=dict, description="확정된 브랜드 프로필 정보")
    brand_concept_strategy: Dict[str, Any] = Field(default_factory=dict, description="브랜드 전략 정보 (콘셉트, 핵심가치, 톤앤매너 등)")
    trend_recommendations: Dict[str, Any] = Field(default_factory=dict, description="RAG, Tavily 기반 추천 정보 (분위기, 키워드, 색상, 슬로건 등)")
    is_confirmed: bool = Field(False, description="브랜드 정보 확정 여부")
    project_id: Optional[str] = Field(None, description="연결된 프로젝트 ID")
    session_created_at: Optional[str] = Field(None, description="세션 생성 시각 (ISO 8601 형식)")
    session_updated_at: Optional[str] = Field(None, description="세션 마지막 업데이트 시각 (ISO 8601 형식)")
    messages: List[Dict[str, Any]] = Field(default_factory=list, description="대화 메시지 히스토리 (LangChain 메시지 형식)")

class ChatSessionResponse(BaseModel):
    state: ChatState


ChatMessageResponse = ChatSessionResponse