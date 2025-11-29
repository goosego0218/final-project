# 쇼츠 LangGraph
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성
# - 2025-11-27: generate_shorts_node 추가 (로고 분기 제거)

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AppState
from app.llm.client import get_chat_model, get_fast_chat_model, get_genai_client


# 노드 함수들 import
from app.graphs.nodes.shorts.decision_node import make_decision_node
from app.graphs.nodes.shorts.general_chat_node import make_general_chat_node
from app.graphs.nodes.shorts.trend_analysis_node import make_trend_analysis_node
# from app.graphs.nodes.shorts.check_logo_node import make_check_logo_node
# from app.graphs.nodes.shorts.fetch_logo_node import make_fetch_logo_node
from app.graphs.nodes.shorts.generate_prompt_no_logo_node import make_generate_prompt_no_logo_node
from app.graphs.nodes.shorts.generate_shorts_node import make_generate_shorts_node 

checkpointer = MemorySaver()

def build_shorts_graph():
    """
    숏폼용 LangGraph 
    """

    llm = get_chat_model()
    fast_llm = get_fast_chat_model()
    genai_client = get_genai_client()  # None일 수 있음 (API 키 없을 때)

    # 프롬프트 생성용 : gpt-5
    # 이미지 생성 구글키도필요
    # 그외 잡채팅은 gpt-4o-mini가 빠를듯
    # 노드마다 다르게 넣어줄필요.

    decision = make_decision_node(llm)
    general_chat = make_general_chat_node(fast_llm)
    trend_analysis = make_trend_analysis_node(llm)
    # check_logo = make_check_logo_node(llm)
    # fetch_logo = make_fetch_logo_node(llm)
    generate_prompt_no_logo = make_generate_prompt_no_logo_node(llm)
    generate_shorts = make_generate_shorts_node(genai_client)  # None일 수 있음 (노드에서 처리)  

    # 그래프 생성
    graph = StateGraph(AppState)
    
    # 노드 추가
    graph.add_node("decision", decision)
    graph.add_node("general_chat", general_chat)
    graph.add_node("trend_analysis", trend_analysis)
    # graph.add_node("check_logo", check_logo)
    # graph.add_node("fetch_logo", fetch_logo)
    graph.add_node("generate_prompt_no_logo", generate_prompt_no_logo)
    graph.add_node("generate_shorts", generate_shorts)
    
    # 엣지 연결
    graph.add_edge(START, "decision")
    graph.add_edge("general_chat", END)
    graph.add_edge("trend_analysis", END)
    
    # graph.add_edge("fetch_logo",END)
    # graph.add_edge("generate_prompt_no_logo",END)
    graph.add_edge("generate_prompt_no_logo", "generate_shorts")  
    graph.add_edge("generate_shorts", END)  
    
    # decision 노드는 Command.goto로 분기하므로 add_conditional_edges 불필요
    
    return graph.compile(checkpointer=checkpointer)