# src/brandbot/nodes/trend_edit.py
from __future__ import annotations
from typing import Dict, Any, List
from brandbot.state import SessionState
from brandbot.utils.llm import LLM
from brandbot.utils.tracing import log_state
from brandbot.state import last_user_text

def _merge_list_uniq(base: List[str] | None, inc: List[str] | None) -> List[str]:
    base = list(base or [])
    for v in (inc or []):
        if v not in base:
            base.append(v)
    return base

async def trend_edit(state: SessionState) -> SessionState:
    text = last_user_text(state)
    llm = LLM()
    edits = await llm.extract_trend_edit(text)

    recos = dict(state.get("trend_recos") or {})
    if "reco_tone" in edits:
        recos["reco_tone"] = edits["reco_tone"]
    if "reco_slogan" in edits:
        recos["reco_slogan"] = edits["reco_slogan"]
    if "reco_keywords" in edits:
        recos["reco_keywords"] = _merge_list_uniq(recos.get("reco_keywords"), edits["reco_keywords"])
    if "reco_colors" in edits:
        recos["reco_colors"] = _merge_list_uniq(recos.get("reco_colors"), edits["reco_colors"])

    log_state(state, "trend_edit:applied", edits=edits, after=recos)
    # 수정 사항을 1턴 동안 표시
    return {"trend_recos": recos, "_trend_ready": True}
