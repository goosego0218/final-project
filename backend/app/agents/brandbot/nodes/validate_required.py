# src/brandbot/nodes/validate_required.py
from brandbot.state import SessionState

_REQUIRED_KEYS = ["name", "industry"]

async def validate_required(state: SessionState) -> SessionState:
    draft = state.get("brand_draft") or {}
    missing = [k for k in _REQUIRED_KEYS if not draft.get(k)]
    return {
        "required_ok": len(missing) == 0,
        "_missing_required": missing,
    }
