# 로고 트렌드 분석 노드
# 작성일: 2025-12-05

from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langchain_core.messages import AIMessage
from langgraph.types import Command
from langgraph.graph import END

from app.agents.trend_agent import run_trend_query_for_api
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_logo_trend_analysis_node(llm: "BaseChatModel"):
    """
    로고 트렌드 분석 노드 팩토리
    """
    def trend_analysis_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        트렌드 분석 노드 (mode="logo")
        """
        query = get_last_user_message(state) or ""

        project_id = state.get("project_id")
        brand_profile = dict(state.get("brand_profile") or {})
        meta = state.get("meta") or {}
        user_id = meta.get("user_id")

        # 트렌드 에이전트 호출 (mode="logo")
        answer = run_trend_query_for_api(
            query=query,
            mode="logo",  
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