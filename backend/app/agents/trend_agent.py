# RAG + Tavily + Jina Rerank 트렌드 에이전트
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-19: 초기 작성

from __future__ import annotations

from typing import Any, Dict, Optional

import logging

from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage

from app.agents.state import AppState
from app.agents.tools.trend_tools import (
    rag_search_tool,
    tavily_web_search_tool,
    apply_reranker_tool,
)
from app.llm.client import get_chat_model

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# 트렌드 서브에이전트 시스템 프롬프트
# (기존 SUBAGENT1_SYSTEM_PROMPT 를 기반으로 재구성)
# -------------------------------------------------------------------
SUBAGENT1_SYSTEM_PROMPT = """
너는 **RAG 통합 검색 전문 에이전트**다.

# 역할
사용자의 검색 질문을 받으면, 다음 전략으로 최적의 검색 결과를 제공한다:

1. **내부 DB 우선**: 먼저 `rag_search_tool`로 내부 벡터 DB 검색
2. **결과 평가**: 검색 결과가 충분한지 판단
   - 관련 문서 3개 이상이면, 우선 내부 결과로 답변을 시도한다.
   - 관련 문서가 부족하거나 내용이 빈약하면, 추가 검색이 필요하다.
3. **웹 검색 보완**: 내부 자료가 부족하면 `tavily_web_search_tool`로 최신 정보를 추가한다.
4. **Reranking**: 모든 검색이 완료되면 `apply_reranker_tool`로 최종 재정렬한다.
5. **결과 통합**: 재정렬된 상위 문서들을 종합하여 한글로 친절하고 구조화된 답변을 생성한다.

# 도구 사용 규칙

## rag_search_tool
- 항상 **첫 번째로 시도**되는 검색 도구
- 내부 마크다운/트렌드 DB 검색
- 결과가 충분하면 이것만으로도 답변 가능

## tavily_web_search_tool
- 내부 검색 결과가 부족할 때만 사용
- 최신 트렌드, 통계, 사례가 필요한 경우
- 검색 쿼리를 구체적으로 작성 (연도, 키워드, 타깃 포함)

## apply_reranker_tool
- **RAG + Tavily 검색이 끝난 후 반드시 한 번 이상 사용**
- `_last_docs`에 쌓인 모든 문서를 대상으로 재정렬
- 최종 답변을 생성하기 전 마지막 단계로 호출

# 출력 형식 가이드

- 가능한 한 **한글로**, 명확하고 구조화된 형식으로 답변한다.
- 필요한 경우 다음과 같이 섹션을 나눈다.
  1. 요약
  2. 핵심 트렌드
  3. 타깃별 인사이트
  4. 실행 아이디어
  5. 참고 자료 (필요 시)

- 근거가 된 내용이 있으면 '근거' 섹션에서 간단히 정리한다.
- 도구 호출 로그나 내부 시스템 설명은 그대로 노출하지 않는다.
"""

# -------------------------------------------------------------------
# LangGraph ReAct 에이전트 생성
# -------------------------------------------------------------------

_memory = MemorySaver()

_trend_agent = create_react_agent(
    model=get_chat_model(),
    tools=[
        rag_search_tool,
        tavily_web_search_tool,
        apply_reranker_tool,
    ],
    prompt=SUBAGENT1_SYSTEM_PROMPT,
    state_schema=AppState,   # ✅ AppState 기반
    checkpointer=_memory,
)


def run_trend_query_for_api(
    query: str,
    *,
    mode: str = "brand",
    project_id: Optional[int] = None,
    brand_profile: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
) -> str:
    """
    FastAPI API에서 직접 호출할 때 사용하는 래퍼 함수.

    - AppState 구조를 맞춰서 초기 state를 구성하고
    - _trend_agent.invoke(...) 를 호출한 뒤
    - 마지막 메시지의 content만 뽑아서 문자열로 반환한다.
    """
    logger.info(
        "[trend_agent] run_trend_query_for_api user_id=%s project_id=%s mode=%s query=%s",
        user_id,
        project_id,
        mode,
        query,
    )

    initial_state: AppState = {
        "messages": [HumanMessage(content=query)],
        "mode": mode,                       # "brand" / "logo" / "shorts"
        "project_id": project_id,
        "brand_profile": brand_profile or {},
        "trend_context": {},               # 처음에는 비어 있고, 도중에 도구/에이전트가 채울 수 있음
        "meta": {"user_id": user_id},
    }

    result_state = _trend_agent.invoke(initial_state)
    messages = result_state["messages"]
    if not messages:
        return "응답을 생성하지 못했습니다."

    final_msg = messages[-1]
    # LangChain 메시지 객체일 경우 .content 사용
    content = getattr(final_msg, "content", None)
    if isinstance(content, str):
        return content

    # content가 list 형식일 수도 있으니 fallback 처리
    return str(content)