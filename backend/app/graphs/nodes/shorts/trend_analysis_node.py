# 트렌드 분석 노드
# 작성자: 주후상
# 작성일: 2025-11-22

from __future__ import annotations
from typing import TYPE_CHECKING

from langchain_core.messages import SystemMessage

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel

def make_trend_analysis_node(llm: "BaseChatModel"):
    """
    트렌드 분석 노드 팩토리.
    """
    def trend_analysis_node(state: "AppState") -> dict:
        """
        트렌드 분석 노드
        - graph_test/nodes.py의 trend_analysis_node 로직 사용
        - TODO: 실제 트렌드 에이전트 연동 필요 (app.agents.trend_agent 참고)
        """
        messages = [
            SystemMessage(content="트렌드 분석을 수행하겠습니다."),
        ] + list(state.get("messages", []))
        
        ai_msg = llm.invoke(messages)
        
        return {
            "messages": [ai_msg]
        }
    
    return trend_analysis_node