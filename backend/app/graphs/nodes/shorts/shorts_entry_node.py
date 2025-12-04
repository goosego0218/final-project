# 숏폼 생성 플로우 진입 노드
# 작성일: 2025-12-03
# 수정내역
# - 2025-12-03: 초기 작성

from __future__ import annotations

from typing import Dict, Any

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from app.agents.state import AppState

from app.graphs.nodes.common.message_utils import get_last_user_message


def make_shorts_entry_node():
    """
    숏폼 생성 플로우 진입 노드 팩토리.
    """
    def shorts_entry_node(state: "AppState") -> Dict[str, Any]:
        """
        숏폼 생성 플로우 진입 노드.
        - 이번 턴 사용자 발화를 shorts_state.user_utterance에 저장한다.
        - 아직 분기/의사결정은 하지 않고, 단순히 상태만 세팅한다.
        """

        shorts_state: Dict[str, Any] = dict(state.get("shorts_state") or {})
        last_user = get_last_user_message(state) or ""

        # 이번 턴 사용자 발화 원문 저장
        shorts_state["user_utterance"] = last_user

        return {
            "shorts_state": shorts_state,
        }
    
    return shorts_entry_node
