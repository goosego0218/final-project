# src/brandbot/nodes/trend_brief.py
from brandbot.state import SessionState
from brandbot.utils.llm import LLM

async def trend_brief(state: SessionState) -> SessionState:
    draft = state.get("brand_draft", {}) or {}
    llm = LLM()
    brief = await llm.make_trend_brief(draft)
    return {"trend_brief": brief or {}}
