# 브랜드 에이전트용 트렌드 검색 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성


from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Any

from langchain_core.messages import AIMessage

from app.graphs.nodes.common.message_utils import get_last_user_message
from app.agents.trend_agent import run_trend_query_for_api

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_brand_trend_search_node(llm: "BaseChatModel"):
    """
    브랜드 에이전트에서 사용할 트렌드 검색 노드 팩토리.
    - llm 인자는 시그니처 통일을 위한 것이고, 이 노드 내부에서는 사용하지 않는다.
    - 실제 트렌드 분석은 app.agents.trend_agent.run_trend_query_for_api 가 담당한다.
    """

    def trend_search(state: "AppState") -> "AppState":
        """
        사용자의 마지막 발화를 트렌드 질의로 삼아 trend_agent 를 호출하고,
        결과를 messages 및 trend_context 에 반영하는 노드.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            # 유저 발화가 없으면 트렌드 검색을 할 수 없음
            return {}

        mode = state.get("mode") or "brand"
        project_id = state.get("project_id")
        brand_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})
        user_id = state.get("user_id")

        # trend_agent 의 범용 함수 호출
        answer = run_trend_query_for_api(
            query=user_text,
            mode=mode,
            project_id=project_id,
            brand_profile=brand_profile or None,
            user_id=user_id,
        )

        # trend_context 업데이트
        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})
        trend_context["last_query"] = user_text
        trend_context["last_result_summary"] = answer

        # 트렌드 결과를 히스토리에 AIMessage 로 추가
        messages = list(state.get("messages") or [])
        messages.append(AIMessage(content=answer))

        return {
            "trend_context": trend_context,
            "messages": messages,
        }

    return trend_search
