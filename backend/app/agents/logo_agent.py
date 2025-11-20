# 로고 LangGraph
# 작성자: 황기준
# 작성일: 2025-11-19
# 수정이력
# - 2025-11-19: 초기 작성

from __future__ import annotations
from typing import Literal

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage, AnyMessage
from langgraph.graph.message import add_messages

from app.agents.state import AppState
from app.llm.client import get_chat_model
from langgraph.checkpoint.memory import MemorySaver
from app.graphs.nodes.logo.state import LogoState
from app.graphs.nodes.logo import (
    select_type_node,
    load_reference_node,
    generate_node,
    finalize_node,
)



def build_logo_workflow():
    """
    나노바나나를 이용한 로고워크플로우를 agents 모듈에서 제공하도록 분리.
    """
    graph = StateGraph(LogoState)

    graph.add_node("select_type", select_type_node)
    graph.add_node("load_reference", load_reference_node)
    graph.add_node("generate", generate_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("select_type")
    graph.add_edge("select_type", "load_reference")
    graph.add_edge("load_reference", "generate")
    graph.add_edge("generate", "finalize")

    return graph.compile()
