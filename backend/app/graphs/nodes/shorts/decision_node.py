# 의도 분류 노드
# 작성자: 주후상
# 작성일: 2025-11-22
# 수정내역

from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import Command

from app.graphs.nodes.shorts.prompts import DECISION_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel

def make_decision_node(llm: "BaseChatModel"):
    """
    LLM 인스턴스를 주입받아 decision 노드를 생성하는 팩토리.
    - brand_intention_node와 동일한 팩토리 패턴 사용
    """
    def decision_node(state: "AppState") -> Command[Literal["check_logo", "general_chat", "trend_analysis"]]:
        """
        분기 판단 노드: LLM이 사용자 의도를 파악하여 세 갈래로 분기
        - graph_test/nodes.py의 decision_node 로직 사용
        - 사용자 메시지가 없으면 general_chat으로 기본 분기
        """
        # 마지막 사용자 메시지 찾기
        messages = state.get("messages", [])
        last_user_message = None
        for m in reversed(messages):
            if isinstance(m, HumanMessage):
                last_user_message = m
                break
        
        if last_user_message is None:
            # 사용자 메시지가 없으면 일반 대화로 분기
            return Command(goto="general_chat")
        
        # LLM으로 의도 분류
        prompt_messages = [
            SystemMessage(content=DECISION_SYSTEM_PROMPT),
            last_user_message
        ]
        response = llm.invoke(prompt_messages)
        content = response.content.lower().strip()
        
        # 분기 로직
        if "check_logo" in content:
            return Command(goto="check_logo")
        elif "general_chat" in content:
            return Command(goto="general_chat")
        elif "trend_analysis" in content:
            return Command(goto="trend_analysis")
    
    return decision_node