# 트렌드 에이전트 테스트 엔드포인트
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성

from __future__ import annotations

from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.models.auth import UserInfo
from app.agents.trend_agent import run_trend_query_for_api

router = APIRouter(
    prefix="/trend",
    tags=["trend"],
)


class TrendQueryRequest(BaseModel):
    query: str = Field(
        default="요즘 20대 여성 대상 카페 인스타 릴스 트렌드를 알려줘.",
        description="트렌드/마케팅 관련 자연어 질문",
    )
    mode: str = Field(
        default="brand",
        description="에이전트 모드 (brand | logo | shorts)",
        examples=["brand"],
    )
    project_id: Optional[int] = Field(
        default=None,
        description="옵션: 연결할 프로젝트/브랜드 ID",
    )

    # 테스트용 브랜드 컨텍스트 (Swagger에서 기본값으로 들어가게)
    brand_name: Optional[str] = Field(
        default="봉봉 커피",
        description="테스트용 브랜드명 예시",
    )
    industry: Optional[str] = Field(
        default="카페",
        description="테스트용 업종 예시",
    )


class TrendQueryResponse(BaseModel):
    answer: str


@router.post("/query", response_model=TrendQueryResponse)
def query_trend(
    payload: TrendQueryRequest,
    current_user: UserInfo = Depends(get_current_user),
):
    """
    트렌드/마케팅 관련 질문을 LangGraph 트렌드 에이전트에게 전달하는 엔드포인트.
    """
    brand_profile: Dict[str, Any] = {}
    if payload.brand_name:
        brand_profile["name"] = payload.brand_name
    if payload.industry:
        brand_profile["industry"] = payload.industry

    answer = run_trend_query_for_api(
        query=payload.query,
        mode=payload.mode,
        project_id=payload.project_id,
        brand_profile=brand_profile,
        user_id=current_user.id,
    )
    return TrendQueryResponse(answer=answer)
