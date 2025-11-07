# src/brandbot/graph/routes.py
from typing import Literal
from brandbot.state import SessionState

# ensure_scope 이후 분기: 스코프 밖이면 에러, 아니면 세션 초기화
def route_after_scope(state: SessionState) -> Literal["error", "init_session"]:
    return "error" if state.get("_intent") == "scope_out" else "init_session"

# trend_gate 이후 분기 태그는 반드시 intent 태그로 통일: "trend" | "confirm" | "collect"
def route_after_gate(state: SessionState) -> Literal["trend", "confirm", "collect"]:
    intent = state.get("_intent") or "collect"
    if intent not in ("trend", "confirm", "collect"):
        intent = "collect"
    return intent

# snapshot 이후: 확정이면 persist, 아니면 END(대기)
def route_after_snapshot(state: SessionState) -> Literal["persist", "stop"]:
    return "persist" if state.get("_intent") == "confirm" else "stop"
