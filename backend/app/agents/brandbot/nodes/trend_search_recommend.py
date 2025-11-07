# src/brandbot/nodes/trend_search_recommend.py
from __future__ import annotations
from typing import Dict, Any, List

from brandbot.state import SessionState
from brandbot.utils.llm import LLM
from brandbot.utils.search import TavilySearch, build_trend_query
from brandbot.utils.tracing import log_state

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
    tav = TavilySearch()
    try:
        # Tavily 결과는 보수적으로 k 제한
        results = tav.search(query, k=8)
        # 결과는 다양한 필드가 있을 수 있어도 일단 모두 전달
        # (llm.summarize_recos_from_web 내부에서 title/snippet로 슬림화)
        log_state(state, "trend_search", query=query, found=len(results or []))
    except Exception as e:
        log_state(state, "trend_search:error", query=query, error=type(e).__name__)
        return {
            "trend_recos": {
                "notes": [f"트렌드 검색 오류: {type(e).__name__}. 잠시 후 다시 시도해주세요."]
            },
            "_trend_ready": True
        }

    # 2) LLM 요약(추천 4종) — 내부에서 토큰 가드 + 백오프 + 폴백
    llm = LLM()
    corpus: List[Dict[str, Any]] = [
        {
            "title": r.get("title") or "",
            "url": r.get("url") or "",
            "snippet": r.get("snippet") or "",
            "content": r.get("content") or "",  # 일부 결과만 content 존재
        }
        for r in (results or [])
    ]
    try:
        recos = await llm.summarize_recos_from_web(seed, corpus)
    except Exception as e:
        # LLM 요약 단계에서의 예외도 폴백
        recos = {
            "reco_tone": seed.get("tone") or "친근하고 부드러운",
            "reco_keywords": (seed.get("keywords") or [])[:4] or ["심플", "포근함", "내추럴", "미니멀"],
            "reco_colors": ["크림", "브라운", "세이지", "딥그린"],
            "reco_slogan": "하루를 부드럽게 시작하는 한 잔",
            "notes": [f"요약 실패: {type(e).__name__}"]
        }

    # 3) 상태 저장 + 로그
    log_state(state, "trend_search:recos", recos=recos)
    return {"trend_recos": recos, "_trend_ready": True}