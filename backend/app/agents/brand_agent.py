# 브랜드 LangGraph 빌더
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성
# - 2025-11-20: 노드 분리 후 빌드/컴파일 전용으로 리팩터링
# - 2025-11-20: brand_intention 노드 추가
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.state import AppState
from app.llm.client import get_chat_model

# 노드 함수
from app.graphs.nodes.brand.brand_collect_node import make_brand_collect_node
from app.graphs.nodes.brand.brand_chat_node import make_brand_chat_node
from app.graphs.nodes.brand.brand_intention_node import make_brand_intention_node
from app.graphs.nodes.brand.brand_trend_search_node import make_brand_trend_search_node
from app.graphs.nodes.brand.brand_trend_refine_node import make_brand_trend_refine_node


# 세션별 대화 히스토리 유지를 위한 체크포인터
checkpointer = MemorySaver()


def build_brand_graph():
    """
    브랜드용 LangGraph 빌더.

    여기서 각 노드의 실제 로직은
    app.graphs.nodes.brand.* 모듈에 정의되어 있음
    이 함수는 단순히:
      - 노드 등록
      - 엣지 연결
      - 그래프 컴파일
    만 담당합니다.
    """
    # 여기서 한 번만 LLM 생성
    llm = get_chat_model()

    # 노드 함수 생성
    brand_collect = make_brand_collect_node(llm)
    brand_intention = make_brand_intention_node(llm)
    brand_trend_search = make_brand_trend_search_node(llm)
    brand_trend_refine = make_brand_trend_refine_node(llm)
    brand_chat = make_brand_chat_node(llm)

    g = StateGraph(AppState)

    # 노드 등록
    g.add_node("brand_collect", brand_collect)
    g.add_node("brand_intention", brand_intention)
    g.add_node("trend_search", brand_trend_search)
    g.add_node("trend_refine", brand_trend_refine)
    g.add_node("brand_chat", brand_chat)

    # 기본 흐름
    g.add_edge(START, "brand_collect")
    g.add_edge("brand_collect", "brand_intention")

    # brand_intention 이후에는 Command.goto 로 분기하므로
    # 여기서 add_conditional_edges 는 필요 없음.

    # trend_refine → trend_search → brand_chat → END 직선 흐름만 정의
    g.add_edge("trend_refine", "trend_search")
    g.add_edge("trend_search", "brand_chat")
    g.add_edge("brand_chat", END)

    return g.compile(checkpointer=checkpointer)
