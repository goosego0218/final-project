# 쇼츠 LangGraph
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

def shorts_node(state: AppState) -> AppState:
    """
    숏폼(쇼츠/릴스/틱톡) 아이디어 및 스크립트 초안을 만드는 노드.
    - 지금은 한 번 호출로 기획+스크립트를 같이 만들어주는 형태.
    - 나중에 '아이디어 구상' / '스크립트 정제' / '후킹 문구 생성' 등으로 쪼갤 수 있음.
    """
    system_prompt = (
        "너는 숏폼(쇼츠/릴스/틱톡) 콘텐츠 기획자야.\n"
        "브랜드의 톤과 타깃에 맞게, 15~30초짜리 영상 콘셉트와 대본을 만들어라.\n"
        "1) 영상 콘셉트 요약\n"
        "2) 장면별 구성(장면 1, 2, 3...)\n"
        "3) 자막/후킹 문구 제안\n"
        "형식으로 한국어로 작성해라."
    )

    messages = [SystemMessage(content=system_prompt)] + state["messages"]

    ai_msg = llm.invoke(messages)

    return {
        "messages": [ai_msg],
    }


def build_shorts_graph():
    """
    숏폼용 LangGraph 최소 버전.
    - START -> shorts_node -> END
    """
    graph = StateGraph(AppState)

    graph.add_node("shorts_chat", shorts_node)

    graph.add_edge(START, "shorts_chat")
    graph.add_edge("shorts_chat", END)

    return graph.compile(checkpointer=checkpointer)