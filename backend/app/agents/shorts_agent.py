# 쇼츠 LangGraph
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성
# - 2025-11-27: generate_shorts_node 추가 (로고 분기 제거)
# - 2025-12-04: decide_logo_image_node, generate_shorts_with_logo_node 제거

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AppState
from app.llm.client import get_chat_model, get_fast_chat_model, get_genai_client

from app.graphs.nodes.shorts.decision_node import make_decision_node
from app.graphs.nodes.shorts.general_chat_node import make_general_chat_node
from app.graphs.nodes.shorts.trend_analysis_node import make_trend_analysis_node
from app.graphs.nodes.shorts.shorts_entry_node import make_shorts_entry_node
from app.graphs.nodes.shorts.analyze_user_request_node import make_analyze_user_request_node
from app.graphs.nodes.shorts.generate_prompt_no_logo_node import make_generate_prompt_no_logo_node
from app.graphs.nodes.shorts.generate_prompt_with_image_node import make_generate_prompt_with_image_node
from app.graphs.nodes.shorts.generate_shorts_node import make_generate_shorts_node 

checkpointer = MemorySaver()


def build_shorts_graph():
    """
    숏폼용 LangGraph
    """

    llm = get_chat_model()
    fast_llm = get_fast_chat_model()
    genai_client = get_genai_client()  # None일 수 있음 (API 키 없을 때)

    # 노드 인스턴스 생성
    decision = make_decision_node(llm)
    general_chat = make_general_chat_node(fast_llm)
    trend_analysis = make_trend_analysis_node(llm)
    shorts_entry = make_shorts_entry_node()
    analyze_user_request = make_analyze_user_request_node(fast_llm)
    generate_prompt_no_logo = make_generate_prompt_no_logo_node(llm)
    generate_prompt_with_image = make_generate_prompt_with_image_node(llm)
    generate_shorts = make_generate_shorts_node(genai_client)

    # 그래프 생성
    graph = StateGraph(AppState)

    # 노드 등록
    graph.add_node("decision", decision)
    graph.add_node("general_chat", general_chat)
    graph.add_node("trend_analysis", trend_analysis)
    graph.add_node("shorts_entry", shorts_entry)
    graph.add_node("analyze_user_request", analyze_user_request)
    graph.add_node("generate_prompt_no_logo", generate_prompt_no_logo)
    graph.add_node("generate_prompt_with_image", generate_prompt_with_image)
    graph.add_node("generate_shorts", generate_shorts)

    # 기본 엣지
    graph.add_edge(START, "decision")
    graph.add_edge("general_chat", END)
    graph.add_edge("trend_analysis", END)

    # input_mode 기반 분기 함수
    def route_by_input_mode(state: "AppState") -> str:
        """input_mode에 따라 프롬프트 생성 노드 분기"""
        shorts_state = state.get("shorts_state") or {}
        input_mode = shorts_state.get("input_mode", "profile_to_video")

        if input_mode == "image_to_video":
            return "generate_prompt_with_image"
        else:
            return "generate_prompt_no_logo"

    # 숏폼 플로우: entry → 요구사항 분석
    graph.add_edge("shorts_entry", "analyze_user_request")

    # analyze_user_request 이후, input_mode에 따라 분기
    graph.add_conditional_edges(
        "analyze_user_request",
        route_by_input_mode,
        {
            "generate_prompt_with_image": "generate_prompt_with_image",
            "generate_prompt_no_logo": "generate_prompt_no_logo",
        },
    )

    # 프롬프트 생성 후, 공통으로 영상 생성 노드로 연결
    graph.add_edge("generate_prompt_with_image", "generate_shorts")
    graph.add_edge("generate_prompt_no_logo", "generate_shorts")
    graph.add_edge("generate_shorts", END)

    return graph.compile(checkpointer=checkpointer)