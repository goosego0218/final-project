# 로고 LangGraph
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성

from __future__ import annotations
from typing import Literal

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage, AnyMessage
from langgraph.graph.message import add_messages

from app.agents.state import AppState
from app.llm.client import get_chat_model
from langgraph.checkpoint.memory import MemorySaver

llm = get_chat_model()

checkpointer = MemorySaver()

# 이 부분은 현재 LangGraph 예시 코드입니다.

def logo_node(state: AppState) -> AppState:
    """
    로고 콘셉트/디자인 브리프를 잡아주는 기본 노드.
    - 지금은 단순히 로고 아이디어를 말로만 정리해 주는 용도.
    - 나중에 이미지 생성 호출용 노드(툴) 분리하면 됨.
    """
    system_prompt = (
        "너는 브랜드 로고 디자이너야.\n"
        "브랜드의 분위기, 타깃, 키워드를 바탕으로 로고 콘셉트와 스타일을 제안해라.\n"
        "색상, 폰트 느낌, 심볼 모티브 등을 구체적으로 설명해라.\n"
        "대답은 한국어로, 디자이너에게 전달할 수 있는 브리프 형태로 작성해라."
    )

    messages = [SystemMessage(content=system_prompt)] + state["messages"]

    ai_msg = llm.invoke(messages)

    return {
        "messages": [ai_msg],
    }


def build_logo_graph():
    """
    로고용 LangGraph 최소 버전.
    - START -> logo_node -> END
    """
    graph = StateGraph(AppState)

    graph.add_node("logo_chat", logo_node)

    graph.add_edge(START, "logo_chat")
    graph.add_edge("logo_chat", END)

    return graph.compile(checkpointer=checkpointer)