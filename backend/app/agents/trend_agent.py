# RAG + Tavily + Jina Rerank 트렌드 에이전트
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-19: 초기 작성 (create_react_agent 버전)
# - 2025-11-19: create_agent + AgentState(AppState) 버전으로 변경
# - 2025-11-25: prompt 분리 후 get_trend_system_prompt 함수 사용
# - 2025-11-25: mode 별 역할 프롬프트 + brand_profile 컨텍스트 추가

from __future__ import annotations

from typing import Any, Dict, Optional
import json
import logging

from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.agents.state import AppState
from app.graphs.tools.trend_tools import (
    rag_search_tool,
    tavily_web_search_tool,
    apply_reranker_tool,
)
from app.llm.client import get_chat_model
from app.agents.prompts.trend_prompts import (
    TREND_AGENT_SYSTEM_PROMPT,
    get_trend_mode_prompt,
)

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# 트렌드 서브에이전트 시스템 프롬프트 (RAG/도구 사용 규칙)
# -------------------------------------------------------------------
SYSTEM_PROMPT = TREND_AGENT_SYSTEM_PROMPT

# -------------------------------------------------------------------
# LangGraph + LangChain v1 create_agent 기반 에이전트 생성
# -------------------------------------------------------------------

_memory = MemorySaver()

_trend_agent = create_agent(
    model=get_chat_model(),
    tools=[
        rag_search_tool,
        tavily_web_search_tool,
        apply_reranker_tool,
    ],
    system_prompt=SYSTEM_PROMPT,
    state_schema=AppState,
    checkpointer=_memory,
)


def run_trend_query_for_api(
    query: str,
    *,
    mode: str,  # 기본값 제거 → 필수 파라미터로 변경
    project_id: Optional[int] = None,
    brand_profile: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
) -> str:
    """
    FastAPI API에서 직접 호출할 때 사용하는 래퍼 함수.
    
    Args:
        mode: 에이전트 모드 ("brand" | "logo" | "shorts") - 필수
    ...
    """
    
    logger.info(
        "[trend_agent] run_trend_query_for_api user_id=%s project_id=%s mode=%s query=%s",
        user_id,
        project_id,
        mode,
        query,
    )

    # mode 별 역할 프롬프트 + 브랜드 프로필을 컨텍스트로 제공
    mode_prompt = get_trend_mode_prompt(mode)
    profile_snippet = json.dumps(brand_profile or {}, ensure_ascii=False)

    messages = [
        # 이번 요청이 brand / logo / shorts 중 무엇인지 + 어떤 출력 포맷을 원하는지
        SystemMessage(content=mode_prompt),
        # 브랜드 프로필과 사용자 요청을 한 번에 전달
        HumanMessage(
            content=(
                f"[브랜드 프로필]\n{profile_snippet}\n\n"
                f"[사용자 요청]\n{query}"
            )
        ),
    ]

    initial_state: AppState = {
        "messages": messages,
        # AgentState 기본 필드(remaining_steps)는 기본값 사용
        "mode": mode,                       # "brand" / "logo" / "shorts"
        "project_id": project_id,
        "brand_profile": brand_profile or {},
        "trend_context": {},                # 처음에는 비어 있고, 도중에 도구/에이전트가 채울 수 있음
        "meta": {"user_id": user_id},
    }

    thread_id = f"trend:{user_id or 'anon'}:{project_id or 'none'}"

    result_state = _trend_agent.invoke(
        initial_state,
        config={
            "configurable": {
                "thread_id": thread_id,
            }
        },
    )

    messages = result_state["messages"]
    if not messages:
        return "응답을 생성하지 못했습니다."

    # 가장 마지막 AIMessage를 찾아서 반환
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return msg.content

    # 혹시 AIMessage가 없으면 마지막 메시지 content라도 반환
    final_msg = messages[-1]
    content = getattr(final_msg, "content", None)
    if isinstance(content, str):
        return content

    # content가 list 형식일 수도 있으니 fallback 처리
    return str(content)
