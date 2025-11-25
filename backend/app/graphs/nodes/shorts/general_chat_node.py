# 일반 대화 노드
# 작성자: 주후상
# 작성일: 2025-11-22
# 수정내역

from __future__ import annotations
from typing import TYPE_CHECKING

from langchain_core.messages import SystemMessage

from app.graphs.nodes.shorts.prompts import GENERAL_CHAT_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel

def make_general_chat_node(llm: "BaseChatModel"):
    """
    일반 대화 노드 팩토리.
    """
    def general_chat_node(state: "AppState") -> dict:
        """
        일상 대화 노드
        """
        messages = [SystemMessage(content=GENERAL_CHAT_SYSTEM_PROMPT)] + list(state.get("messages", []))
        ai_msg = llm.invoke(messages)
        
        return {
            "messages": [ai_msg]
        }
    
    return general_chat_node