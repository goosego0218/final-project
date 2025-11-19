# 브랜드 LangGraph
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

def brand_node(state: AppState) -> AppState:
    """
    브랜드 정보 수집/컨설팅을 담당하는 기본 노드.
    - 지금은 그냥 LLM 한 번 호출해서 답변만 추가하는 최소 버전.
    - 나중에 여기서 brand_profile 갱신, 프로젝트 생성/저장 등을 단계별로 쪼개면 됨.
    """
    system_prompt = (
        "너는 브랜드 마케팅 전문가이자 브랜드 전략 컨설턴트야.\n"
        "사용자의 브랜드를 함께 정의하고, 브랜드 톤/무드, 슬로건, 타깃, 키워드 등을 정리해 주어라.\n"
        "대답은 친절하고 구체적으로, 한국어로 답변해라."
    )

    # 기존 대화 + 시스템 프롬프트
    messages = [SystemMessage(content=system_prompt)] + state["messages"]

    ai_msg = llm.invoke(messages)

    # MessagesState 규칙에 맞게 messages 필드에만 append 해주면 됨
    return {
        "messages": [ai_msg],  # add_messages가 있으니 이렇게 반환해도 merge 됨
    }

def build_brand_graph():
    """
    브랜드용 LangGraph 최소 버전.
    - START -> brand_node -> END
    """
    graph = StateGraph(AppState)

    graph.add_node("brand_chat", brand_node)

    graph.add_edge(START, "brand_chat")
    graph.add_edge("brand_chat", END)

    return graph.compile(checkpointer=checkpointer)
