# src/brandbot/nodes/init_session.py
import uuid
from brandbot.state import SessionState, now_utc_iso

async def init_session(state: SessionState) -> SessionState:
    if state.get("session_id"):
        return {}
    return {
        "session_id": str(uuid.uuid4()),
        "created_at": now_utc_iso(),
        "updated_at": now_utc_iso(),
    }
