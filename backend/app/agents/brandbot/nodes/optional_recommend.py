# src/brandbot/nodes/optional_recommend.py
from brandbot.state import SessionState
from brandbot.utils.llm import LLM

OPTIONAL_FIELDS = ["target_age","target_gender","avoid_trends","slogan","colors"]

async def optional_recommend(state: SessionState) -> SessionState:
    draft = state.get("brand_draft") or {}
    llm = LLM()
    # 간단: 트렌드 브리프와 draft를 함께 넣어 필드별 후보 3~5개 생성
    prompt = {
        "draft": draft,
        "trend": state.get("trend_brief") or {},
        "need": OPTIONAL_FIELDS,
    }
    # 구조화까지 가면 좋지만, 우선 자유 JSON로 받아도 OK
    rec = await llm.llm.ainvoke(f"다음 브랜드 초안과 트렌드 제안을 참고하여 "
                                f"{OPTIONAL_FIELDS} 각 항목별 한국어 후보 3~5개 리스트를 JSON으로만 반환하라.\n{prompt}")
    # 최소 안전 처리
    return {"optional_candidates": rec.dict() if hasattr(rec,"dict") else {}}
