from __future__ import annotations

from langgraph.graph import END, StateGraph

from .agent_schema import LogoState, TaskType
from .nodes_v2 import (
    evaluator_node,
    image_operator_node,
    intent_router_node,
    prompt_planner_node,
    result_packager_node,
)


def _route_after_intent(state: LogoState) -> str:
    t = state.get("task_type")
    if t == TaskType.DESCRIBE.value:
        return "describe"
    return "plan"


def _loop_or_finish(state: LogoState) -> str:
    return "finish" if state.get("done") else "regen"


def build_graph_v2() -> StateGraph:
    g = StateGraph(LogoState)

    g.add_node("intent_router", intent_router_node)
    g.add_node("prompt_planner", prompt_planner_node)
    g.add_node("image_operator", image_operator_node)
    g.add_node("evaluator", evaluator_node)
    g.add_node("result_packager", result_packager_node)

    g.set_entry_point("intent_router")

    g.add_conditional_edges(
        "intent_router",
        _route_after_intent,
        {
            "plan": "prompt_planner",
            "describe": "image_operator",
        },
    )

    # For generate/edit/remix, plan -> operate -> evaluate
    g.add_edge("prompt_planner", "image_operator")

    def _after_image_operator(state: LogoState) -> str:
        if state.get("task_type") == TaskType.DESCRIBE.value:
            return "pack"
        return "eval"

    g.add_conditional_edges(
        "image_operator",
        _after_image_operator,
        {
            "eval": "evaluator",
            "pack": "result_packager",
        },
    )

    g.add_conditional_edges(
        "evaluator",
        _loop_or_finish,
        {
            "regen": "image_operator",
            "finish": "result_packager",
        },
    )

    g.add_edge("result_packager", END)
    return g


compiled_graph_v2 = build_graph_v2().compile()
