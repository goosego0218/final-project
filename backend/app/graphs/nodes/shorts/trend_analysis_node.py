# 트렌드 분석 노드
# 작성자: 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-25: trend_agent(run_trend_query_for_api) 연동, mode="shorts" 사용
# - 2025-11-25: Command 타입 사용


from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langchain_core.messages import SystemMessage, AIMessage
from langgraph.types import Command
from langgraph.graph import END

from app.agents.trend_agent import run_trend_query_for_api
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel

def make_trend_analysis_node(llm: "BaseChatModel"):
    """
    트렌드 분석 노드 팩토리.
    """
    def trend_analysis_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        트렌드 분석 노드

        - 마지막 사용자 발화를 query 로 사용해서
          공용 트렌드 에이전트(run_trend_query_for_api)를 호출한다.
        - mode="shorts" 로 고정해서 숏폼 제작에 초점을 맞춘 트렌드 인사이트를 요청한다.
        """
        # 마지막 유저 발화
        query = get_last_user_message(state) or ""

        # 컨텍스트
        project_id = state.get("project_id")
        brand_profile = dict(state.get("brand_profile") or {})
        meta = state.get("meta") or {}
        user_id = meta.get("user_id")

        # 트렌드 에이전트 호출 (mode="shorts")
        answer = run_trend_query_for_api(
            query=query,
            mode="shorts",
            project_id=project_id,
            brand_profile=brand_profile or None,
            user_id=user_id,
        )

        ai_msg = AIMessage(content=answer)

        return Command(
            update={
                "messages": [ai_msg],
            },
            goto=END,
        )

    return trend_analysis_node