# 로고 일반 대화 노드
# 작성일: 2025-12-05

from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langgraph.types import Command
from langgraph.graph import END
from langchain_core.messages import SystemMessage

from app.graphs.nodes.logo.prompts import LOGO_GENERAL_CHAT_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_logo_general_chat_node(llm: "BaseChatModel"):
    """
    로고 일반 대화 노드 팩토리
    """
    def general_chat_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        로고 관련 일상 대화 노드
        """
        messages = [SystemMessage(content=LOGO_GENERAL_CHAT_SYSTEM_PROMPT)] + list(state.get("messages", []))
        ai_msg = llm.invoke(messages)
        
        return Command(
            update={
                "messages": [ai_msg],
            },
            goto=END,
        )
    
    return general_chat_node