from __future__ import annotations
from typing import List
from brandbot.state import SessionState
from brandbot.utils.tracing import log_state

def _merge_list_uniq(base: List[str] | None, inc: List[str] | None) -> List[str]:
    base = list(base or [])
    for v in (inc or []):
        v2 = (v or "").strip()
        if not v2:
            continue
        if v2 not in base:
            base.append(v2)
    return base

async def trend_apply(state: SessionState) -> SessionState:
    draft = dict(state.get("brand_draft") or {})
    recos = state.get("trend_recos") or {}

    before = dict(draft)

    # tone/keywords/colors/slogan 적용 정책
    if recos.get("reco_tone"):
        draft["tone"] = recos["reco_tone"]
    if recos.get("reco_slogan"):
        draft["slogan"] = recos["reco_slogan"]
    if recos.get("reco_keywords"):
        draft["keywords"] = _merge_list_uniq(draft.get("keywords"), recos["reco_keywords"])
    if recos.get("reco_colors"):
        draft["colors"] = _merge_list_uniq(draft.get("colors"), recos["reco_colors"])

    log_state(state, "trend_apply:merged", before=before, after=draft)

    # 이번 턴에 적용됨을 스냅샷에서 바로 보이도록
    return {"brand_draft": draft, "_trend_ready": True}
