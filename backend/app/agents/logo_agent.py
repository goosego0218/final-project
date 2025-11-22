# 로고 LangGraph

from langgraph.graph import StateGraph

from app.graphs.nodes.logo.state import LogoState
from app.graphs.nodes.logo import (
    select_type_node,
    load_reference_node,
    generate_node,
    finalize_node,
)


def build_logo_generate_workflow():
    """로고 생성용 워크플로우 (이미 준비된 입력을 받아 바로 생성)."""
    graph = StateGraph(LogoState)

    graph.add_node("generate", generate_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("generate")
    graph.add_edge("generate", "finalize")

    return graph.compile()


def build_logo_chat_workflow():
    """
    상담/준비용 워크플로우 (타입 설정 + 참조 후보 제안까지만).
    """
    graph = StateGraph(LogoState)

    graph.add_node("select_type", select_type_node)
    graph.add_node("load_reference", load_reference_node)

    graph.set_entry_point("select_type")
    graph.add_edge("select_type", "load_reference")
    graph.add_edge("load_reference", "load_reference")

    return graph.compile()
