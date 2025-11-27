# 로고 LangGraph
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성
# - 2025-11-27: 로고 에이전트 추가

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AppState
from app.llm.client import get_chat_model, get_gemini_image_client

# 노드 함수들 import
from app.graphs.nodes.logo.generate_logo_prompt_node import make_generate_logo_prompt_node
from app.graphs.nodes.logo.generate_logo_node import make_generate_logo_node

checkpointer = MemorySaver()


def build_logo_graph():
    """
    로고용 LangGraph 
    
    START → generate_logo_prompt → generate_logo → END
    """
    
    llm = get_chat_model()
    gemini_image_client = get_gemini_image_client()
    
    # 노드 생성
    generate_logo_prompt = make_generate_logo_prompt_node(llm)
    generate_logo = make_generate_logo_node(gemini_image_client)
    
    # 그래프 생성
    graph = StateGraph(AppState)
    
    # 노드 추가
    graph.add_node("generate_logo_prompt", generate_logo_prompt)
    graph.add_node("generate_logo", generate_logo)
    
    # 엣지 연결 
    graph.add_edge(START, "generate_logo_prompt")
    graph.add_edge("generate_logo_prompt", "generate_logo")
    graph.add_edge("generate_logo", END)
    
    return graph.compile(checkpointer=checkpointer)