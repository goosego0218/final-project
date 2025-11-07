# src/brandbot/nodes/confirm_guard.py
from __future__ import annotations
from typing import List
from brandbot.state import SessionState
from brandbot.utils.tracing import log_state

REQUIRED = ["name","industry"]

def _has(v) -> bool:
    if v is None: return False
    if isinstance(v, str): return bool(v.strip())
    if isinstance(v, (list, tuple, set)): return len(v) > 0
    return True

async def confirm_guard(state: SessionState) -> SessionState:
    draft = state.get("brand_draft") or {}
    missing: List[str] = [k for k in REQUIRED if not _has(draft.get(k))]
    ok = len(missing) == 0
    log_state(state, "confirm_guard", required_ok=ok, missing=missing)
    return {
        "required_ok": ok,
        "_missing_required": missing
    }
