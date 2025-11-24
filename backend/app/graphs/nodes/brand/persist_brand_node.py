# 브랜드 확정 시, DB 저장에 필요한 정보를 meta.persist_request 에 담아두는 노드
# 작성일: 2025-11-21
# 수정내역
# - 2025-11-21: 초기 작성

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Any, Literal
from langgraph.types import Command

if TYPE_CHECKING:
    from app.agents.state import AppState


def make_persist_brand_node():
    """
    브랜드 확정 시, DB 저장에 필요한 정보를 meta.persist_request 에 담아두는 노드.

    - 실제 DB INSERT/UPDATE 는 FastAPI 레이어에서
      project_service 등을 사용해 처리한다.
    - 이 노드는 그래프 안에서 "저장 요청 패킷"만 만들어 준다.
    """

    def persist_brand(state: "AppState") -> Command[Literal["brand_chat"]]:
        # 기존 meta 복사
        meta: Dict[str, Any] = dict(state.get("meta") or {})

        # brand_intention 에서 넣어준 필수 필드 검증 결과
        validation: Dict[str, Any] = dict(meta.get("validation") or {})
        is_valid: bool = bool(validation.get("is_valid", False))

        # 필수 필드가 충족되지 않았는데 들어온 경우: 그냥 brand_chat 으로 넘긴다.
        # (정상 흐름에서는 is_valid == True 일 때만 이 노드로 오도록 라우팅할 예정)
        if not is_valid:
            return Command(update={}, goto="brand_chat")

        project_id = state.get("project_id")
        project_draft: Dict[str, Any] = dict(state.get("project_draft") or {})
        brand_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})

        # FastAPI 쪽에서 그대로 받아서 project_service 로 넘길 수 있게 패킷 구성
        persist_payload: Dict[str, Any] = {
            "project_id": project_id,
            "project_draft": project_draft,
            "brand_profile": brand_profile,
        }

        new_meta = dict(meta)
        new_meta["persist_request"] = {
            "kind": "brand_project",
            "payload": persist_payload,
        }

        # 여기서는 DB를 직접 건드리지 않고,
        # meta 에 "저장 요청"만 남긴 다음 brand_chat 으로 보낸다.
        return Command(
            update={
                "meta": new_meta,
            },
            goto="brand_chat",
        )

    return persist_brand
