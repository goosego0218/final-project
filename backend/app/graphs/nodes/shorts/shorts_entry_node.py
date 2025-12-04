# 숏폼 생성 플로우 진입 노드
# 작성일: 2025-12-03
# 수정내역
# - 2025-12-03: 초기 작성
# - 2025-12-04: 이미지 확인 및 input_mode 설정 추가

from __future__ import annotations

from typing import Dict, Any

from app.agents.state import AppState

from app.graphs.nodes.common.message_utils import get_last_user_message
from app.graphs.nodes.common.image_utils import get_first_image_from_state


def make_shorts_entry_node():
    """
    숏폼 생성 플로우 진입 노드 팩토리.
    """
    def shorts_entry_node(state: "AppState") -> Dict[str, Any]:
        """
        숏폼 생성 플로우 진입 노드.
        - 이번 턴 사용자 발화를 shorts_state.user_utterance에 저장한다.
        - 이미지가 첨부되었는지 확인하고 input_mode를 설정한다.
        """
        shorts_state: Dict[str, Any] = dict(state.get("shorts_state") or {})
        last_user = get_last_user_message(state) or ""
        
        # 이미지 확인 및 input_mode 설정
        image_data = get_first_image_from_state(state)
        if image_data:
            shorts_state["input_mode"] = "image_to_video"
            # 이미지 데이터를 shorts_state에 임시 저장 (나중에 분석 노드에서 사용)
            shorts_state["input_image_data"] = image_data
        else:
            shorts_state["input_mode"] = "profile_to_video"
        
        # 이번 턴 사용자 발화 원문 저장
        shorts_state["user_utterance"] = last_user

        return {
            "shorts_state": shorts_state,
        }
    
    return shorts_entry_node
