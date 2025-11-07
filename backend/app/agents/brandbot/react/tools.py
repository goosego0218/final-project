# src/brandbot/react/tools.py
from __future__ import annotations
from typing import Dict, Any, List, Optional
from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM
from brandbot.nodes.snapshot_review import snapshot_review  # 스냅샷 재사용

_REQUIRED = ["name","industry","tone","keywords"]
_SCALAR_KEYS = ("name","industry","tone","target_age","target_gender","slogan")
_LIST_KEYS   = ("colors","keywords","avoid_trends")
_MIN_CONF = 0.80

def _merge_conservative(draft: dict, updates: List[dict]) -> dict:
    out = dict(draft or {})
    for u in updates:
        field = u.get("name")
        value = u.get("value")
        conf = float(u.get("confidence") or 0.0)
        explicit = bool(u.get("explicit"))

        if field in _SCALAR_KEYS:
            cur = out.get(field)
            if cur in (None, "", []):
                if explicit and conf >= _MIN_CONF:
                    out[field] = value
            else:
                if explicit and conf >= _MIN_CONF:
                    if field == "name":
                        if isinstance(value, str) and len(value.strip()) <= 2:
                            continue
                    out[field] = value

        elif field in _LIST_KEYS:
            if explicit and value:
                cur_list = list(out.get(field) or [])
                if isinstance(value, list):
                    for v in value:
                        if v not in cur_list: cur_list.append(v)
                else:
                    if value not in cur_list: cur_list.append(value)
                out[field] = cur_list
    return out

# ===== 툴들 =====

async def t_collect(state: SessionState, **kwargs) -> Dict[str, Any]:
    """사용자 발화를 구조화 추출 → draft 보수 병합"""
    text = last_user_text(state) or ""
    llm = LLM()
    updates = await llm.extract_brand_updates(text)
    if not updates:
        return {"_note": "no_updates"}
    draft0 = state.get("brand_draft") or {}
    draft1 = _merge_conservative(draft0, updates)
    return {"brand_draft": draft1, "_trend_ready": False}

async def t_validate_required(state: SessionState, **kwargs) -> Dict[str, Any]:
    d = state.get("brand_draft") or {}
    missing = [k for k in _REQUIRED if not d.get(k)]
    return {"required_ok": len(missing)==0, "_missing_required": missing}

async def t_trend_brief(state: SessionState, **kwargs) -> Dict[str, Any]:
    """업종/톤 기반 간단 브리프(L2 제안)"""
    llm = LLM()
    draft = state.get("brand_draft") or {}
    brief = await llm.make_trend_brief(draft)
    return {"trend_brief": brief, "_trend_ready": True}

async def t_optional_recommend(state: SessionState, fields: Optional[List[str]]=None, **kwargs) -> Dict[str, Any]:
    """선택항목 후보 생성(간단 LLM 요약 기반)"""
    llm = LLM()
    want = fields or ["target_age","target_gender","avoid_trends","slogan","colors"]
    seed = {"draft": state.get("brand_draft") or {}, "trend": state.get("trend_brief") or {}, "fields": want}
    out = await llm.llm.ainvoke(
        "다음 seed를 참고하여 fields별 한국어 후보 3~5개를 JSON으로만 반환:\n" + str(seed)
    )
    # 간단 파싱
    data = out.dict() if hasattr(out,"dict") else {}
    return {"optional_candidates": data}

async def t_optional_pick(state: SessionState, updates: Dict[str, Any], **kwargs) -> Dict[str, Any]:
    """사용자 선택 결과를 draft에 반영(예: {'colors':['파스텔 그린']})"""
    draft = dict(state.get("brand_draft") or {})
    for k, v in (updates or {}).items():
        if k in _SCALAR_KEYS:
            draft[k] = v
        elif k in _LIST_KEYS:
            cur = list(draft.get(k) or [])
            if isinstance(v, list):
                for it in v:
                    if it not in cur: cur.append(it)
            else:
                if v not in cur: cur.append(v)
            draft[k] = cur
    return {"brand_draft": draft}

async def t_emit_snapshot(state: SessionState, **kwargs) -> Dict[str, Any]:
    """현재 state로 스냅샷 텍스트 생성"""
    # snapshot_review는 SessionState → {"snapshot_text": "..."} 반환
    snap = await snapshot_review(state)
    return snap

async def t_persist_project(state: SessionState, **kwargs) -> Dict[str, Any]:
    """프로젝트 확정(간단 mock). 실제로는 DB/ID 생성."""
    if not state.get("required_ok"):
        return {"_error": "required_not_satisfied"}
    # 실제 구현에서는 DB insert 후 ID 반환
    import uuid
    pid = f"proj_{uuid.uuid4().hex[:8]}"
    return {"project_id": pid, "confirmed": True}
