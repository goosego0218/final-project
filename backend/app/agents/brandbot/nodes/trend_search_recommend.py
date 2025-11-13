# src/brandbot/nodes/trend_search_recommend.py
from __future__ import annotations
from typing import Dict, Any

from brandbot.state import SessionState
from brandbot.utils.search import build_trend_query
from brandbot.utils.tracing import log_state
from brandbot.subagents.trend_curator import generate_trend_recommendations

async def trend_search_recommend(state: SessionState) -> SessionState:
    """
    업종만 있어도 동작. draft 기반 Tavily 검색 → 웹 요약으로
    reco_tone / reco_keywords / reco_colors / reco_slogan 산출.
    - 검색결과는 요약 단계에서 title+snippet 위주로 슬림화됨(LLM 내부)
    """
    draft = state.get("brand_draft") or {}
    industry = (draft.get("industry") or "").strip()
    if not industry:
        # 업종이 전혀 없으면 최소 가이드
        log_state(state, "trend_search", note="missing_industry")
        return {
            "trend_recos": {
                "notes": ["업종이 필요합니다. 예: 카페/베이커리/패션/IT 등"]
            },
            "_trend_ready": True
        }

    # 1) 검색 쿼리 구성(업종 필수, 나머지 지표 있으면 모두 포함)
    seed = {
        "industry": industry,
        "tone": draft.get("tone"),
        "keywords": draft.get("keywords"),
        "target_age": draft.get("target_age"),
        "target_gender": draft.get("target_gender"),
        "colors": draft.get("colors"),
        "avoid_trends": draft.get("avoid_trends"),
        "slogan": draft.get("slogan"),
    }
    query = build_trend_query(seed)
    log_state(state, "trend_search", query=query, note="subagent_trend_curator")

    # 2) 서브 에이전트가 기본 트렌드 추천 구성
    recos = generate_trend_recommendations(seed)

    # 3) 상태 저장 + 로그
    log_state(state, "trend_search:recos", recos=recos)
    return {"trend_recos": recos, "_trend_ready": True}