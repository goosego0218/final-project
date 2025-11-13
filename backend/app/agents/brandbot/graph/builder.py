from langgraph.graph import StateGraph, START, END
from brandbot.state import SessionState
from brandbot.nodes import (
    ensure_scope,                 # Agent
    init_session,                 # Node
    trend_gate as intent_gate,    # Agent
    brand_collect,                # Node
    validate_required,            # Node
    trend_search_recommend,       # Tool
    trend_edit,                   # Agent
    trend_apply,                  # Tool/Node (추천 적용)
    optional_recommend,           # Tool
    optional_pick,                # Agent
    snapshot_review,              # Node
    confirm_guard,                # Node
    persist_project,              # Tool
    error_handler,                # Node
    edit_confirm,
    edit_choice,
)
from brandbot.graph.routes import route_after_scope

def build_graph():
    g = StateGraph(SessionState)

    # 노드 등록
    g.add_node("ensure_scope", ensure_scope)
    g.add_node("init_session", init_session)
    g.add_node("intent_gate", intent_gate)
    g.add_node("brand_collect", brand_collect)
    g.add_node("validate_required", validate_required)
    g.add_node("trend_search_recommend", trend_search_recommend)
    g.add_node("trend_edit", trend_edit)
    g.add_node("trend_apply", trend_apply)
    g.add_node("optional_recommend", optional_recommend)
    g.add_node("optional_pick", optional_pick)
    g.add_node("snapshot_review", snapshot_review)
    g.add_node("confirm_guard", confirm_guard)
    g.add_node("persist_project", persist_project)
    g.add_node("edit_confirm", edit_confirm)
    g.add_node("edit_choice", edit_choice)
    g.add_node("error_handler", error_handler)

    # 흐름
    g.add_edge(START, "ensure_scope")
    g.add_conditional_edges(
        "ensure_scope",
        route_after_scope,
        {
            "error": "error_handler",
            "init_session": "init_session",
        },
    )
    g.add_edge("init_session", "intent_gate")

    g.add_conditional_edges(
        "intent_gate",
        lambda s: s.get("_intent", "collect"),
        {
            "collect": "brand_collect",
            "trend": "trend_search_recommend",
            "trend_edit": "trend_edit",
            "apply_recos": "trend_apply",
            "review": "snapshot_review",
            "confirm": "confirm_guard",
            "opt_reco": "optional_recommend",
            "edit_choice": "edit_choice",
            "end": END,
        },
    )

    # 수집 → 검증 → 스냅샷
    g.add_conditional_edges(
        "brand_collect",
        lambda s: "edit" if s.get("pending_edit") else "collect",
        {
            "edit": "edit_confirm",
            "collect": "validate_required",
        },
    )
    g.add_edge("validate_required", "snapshot_review")

    # 트렌드 관련
    g.add_edge("trend_search_recommend", "snapshot_review")
    g.add_edge("trend_edit", "snapshot_review")
    g.add_edge("trend_apply", "snapshot_review")

    # 선택값 추천 루프
    g.add_edge("optional_recommend", "optional_pick")
    g.add_edge("optional_pick", "snapshot_review")

    # 확정 가드
    g.add_conditional_edges(
        "confirm_guard",
        lambda s: "ok" if s.get("required_ok") else "lack",
        {
            "ok": "persist_project",
            "lack": "snapshot_review",
        },
    )

    g.add_edge("persist_project", END)
    g.add_edge("error_handler", END)
    g.add_edge("edit_confirm", END)
    g.add_conditional_edges(
        "edit_choice",
        lambda s: "more" if s.get("pending_edit") else ("retry" if s.get("edit_choice_retry") else "done"),
        {
            "more": "edit_confirm",
            "retry": END,
            "done": "validate_required",
        },
    )

    return g.compile()
