# 로고 파일 조회/적용 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Dict, Any

from langchain_core.messages import SystemMessage, AIMessage
from langgraph.types import Command
from langgraph.graph import END

if TYPE_CHECKING:
    from app.agents.state import AppState, ShortsState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_fetch_logo_node(llm: "BaseChatModel"):
    """
    기존 로고를 불러와서 shorts_state에 반영하는 노드 팩토리.

    - check_logo_node 에서 logo_usage_choice == "use_existing" 일 때 호출됨
    - 실제 로고 파일 경로/메타데이터는 아직 DB/스토리지 연동 전이므로 TODO로 남김
    """

    def fetch_logo_node(state: "AppState") -> Command:
        """
        기존 로고 사용 경로.

        역할:
        - 프로젝트에 저장된 기존 로고 정보를 확인
        - shorts_state.logo_file_path 에 경로/식별자 저장
        - LLM에게 "이 프로젝트는 기존 로고를 사용한다"는 컨텍스트를 알려주는 시스템 메시지 생성
        """
        project_id = state.get("project_id")
        shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

        # 1) 이미 logo_file_path 가 있으면 그대로 사용
        logo_path = shorts_state.get("logo_file_path")

        # 2) TODO: 실제로는 DB나 파일 스토리지에서 로고 경로/ID를 조회해야 함
        #    - 예: 프로젝트별 로고 테이블, S3 경로 등
        #    - 지금은 임시로 project_id 기반 더미 경로 사용
        if not logo_path and project_id is not None:
            logo_path = f"/static/logos/project_{project_id}.png"  # TODO: 실제 구현으로 교체
            shorts_state["logo_file_path"] = logo_path

        if logo_path:
            ai_text = (
                "고객님이 현재 등록해 두신 로고는 다음과 같습니다.\n\n"
                f"- 로고 파일 경로(또는 ID): {logo_path}\n\n"
                "원하시는 로고 선택해주세요요"
            )
        else:
            # 로고 경로를 찾지 못한 예외 상황 (임시 처리)
            ai_text = (
                 "현재 프로젝트에 등록된 로고 정보를 찾지 못했습니다."
            )

        summary_msg = AIMessage(content=ai_text)

        return Command(
            update={
                "messages": [summary_msg],
                "shorts_state": shorts_state,
            },
            goto=END,  
        )

    return fetch_logo_node