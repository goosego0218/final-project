# 브랜드 관련 비즈니스 로직
# 작성일: 2025-11-23
# 수정내역
# - 2025-11-23: 브랜드 프로젝트 저장 래퍼 추가

from __future__ import annotations

from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from app.models.project import ProdGroup
from app.models.auth import UserInfo
from app.agents.state import AppState, BrandProfile
from app.services.project_service import persist_brand_project


def persist_brand_from_graph_state(
    db: Session,
    *,
    current_user: UserInfo,
    state: AppState,
) -> Optional[ProdGroup]:
    """
    브랜드 그래프 실행 결과(AppState)를 받아,
    meta.persist_request 해석 -> 프로젝트/브랜드 DB 저장.

    - 그래프/메타/유저 관련 비즈니스 로직은 여기서만 처리.
    - 실제 INSERT/UPDATE 는 project_service.persist_brand_project 가 담당.
    """
    meta: Dict[str, Any] = dict(state.get("meta") or {})
    persist_request = meta.get("persist_request")

    if not isinstance(persist_request, dict):
        return None

    if persist_request.get("kind") != "brand_project":
        return None

    payload: Dict[str, Any] = dict(persist_request.get("payload") or {})

    project_id = payload.get("project_id")
    project_draft = payload.get("project_draft")
    brand_profile: BrandProfile | Dict[str, Any] | None = payload.get("brand_profile")

    group = persist_brand_project(
        db,
        creator_id=current_user.id,
        project_id=project_id,
        project_draft=project_draft,
        brand_profile=brand_profile,
    )

    return group