# 숏폼 영상에 대한 요구사항을 JSON으로 추출하는 노드
# 작성일: 2025-12-03
# 수정내역
# - 2025-12-03: 초기 작성
# - 2025-12-05: JSON 기반 요구사항 추출 제거, 원문 발화 패스 전용으로 변경

from __future__ import annotations

from typing import Dict, Any, TYPE_CHECKING

from app.agents.state import AppState
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from langchain_core.language_models.chat_models import BaseChatModel


def make_analyze_user_request_node(llm: "BaseChatModel"):
    """
    (변경 전)
    - LLM을 호출해서 사용자 발화/브랜드 프로필을 JSON(user_requirements)으로 구조화.

    (변경 후)
    - LLM 호출 없이, 이번 턴 사용자 발화 원문만 shorts_state.user_utterance 에 보존.
    - JSON 기반 user_requirements 는 비워두고 더 이상 사용하지 않음.
    """

    def analyze_user_request_node(state: AppState) -> Dict[str, Any]:
        shorts_state: Dict[str, Any] = dict(state.get("shorts_state") or {})

        # shorts_entry_node 에서 이미 user_utterance 를 채워주지만,
        # 혹시 비어 있으면 messages 에서 한 번 더 가져온다.
        user_utterance = (shorts_state.get("user_utterance") or "").strip()
        if not user_utterance:
            user_utterance = get_last_user_message(state).strip()

        shorts_state["user_utterance"] = user_utterance

        # 기존 JSON 구조화 결과는 더 이상 사용하지 않으므로 비워둔다.
        shorts_state["user_requirements"] = {}

        return {
            "shorts_state": shorts_state,
        }

    return analyze_user_request_node
