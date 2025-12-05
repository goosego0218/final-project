# 로고 LangGraph
# 작성자: 주훗앙
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성
# - 2025-11-27: 로고 에이전트 추가
# - 2025-12-04: 프롬프트생성용모델 추가
# - 2025-12-05: 의도 분류 기반 분기 추가 (decision → generate/chat/trend)

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AppState
from app.llm.client import get_chat_model, get_gemini_image_client, get_fast_chat_model

# 노드 함수들
from app.graphs.nodes.logo.decision_node import make_logo_decision_node
from app.graphs.nodes.logo.general_chat_node import make_logo_general_chat_node
from app.graphs.nodes.logo.trend_analysis_node import make_logo_trend_analysis_node
from app.graphs.nodes.logo.generate_logo_prompt_node import make_generate_logo_prompt_node
from app.graphs.nodes.logo.generate_logo_node import make_generate_logo_node
from app.llm.client import get_logo_prompt_model

checkpointer = MemorySaver()


def build_logo_graph():
    """
    로고용 LangGraph 
    
    START → decision → ┌─ generate_logo_prompt → generate_logo → END
                       ├─ logo_general_chat → END
                       └─ logo_trend_analysis → END
    """
    
    llm = get_chat_model()
    fast_llm = get_fast_chat_model()
    gemini_client = get_gemini_image_client()
    llm_prompt = get_logo_prompt_model()

    # 노드 생성
    decision = make_logo_decision_node(fast_llm)
    general_chat = make_logo_general_chat_node(llm)
    trend_analysis = make_logo_trend_analysis_node(llm)
    generate_logo_prompt = make_generate_logo_prompt_node(llm_prompt)
    generate_logo = make_generate_logo_node(gemini_client)
    
    # 그래프 생성
    graph = StateGraph(AppState)
    
    # 노드 추가
    graph.add_node("decision", decision)
    graph.add_node("logo_general_chat", general_chat)
    graph.add_node("logo_trend_analysis", trend_analysis)
    graph.add_node("generate_logo_prompt", generate_logo_prompt)
    graph.add_node("generate_logo", generate_logo)
    
    # 엣지 연결 
    graph.add_edge(START, "decision")
    graph.add_edge("logo_general_chat", END)
    graph.add_edge("logo_trend_analysis", END)
    graph.add_edge("generate_logo_prompt", "generate_logo")
    graph.add_edge("generate_logo", END)
    
    return graph.compile(checkpointer=checkpointer)