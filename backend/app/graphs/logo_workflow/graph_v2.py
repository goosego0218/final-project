from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.logo_workflow import LogoState
from app.graphs.logo_workflow.nodes_v2 import (
    evaluator_node,
    generation_router_node,
    image_operator_node,
    mode_selection_node,
    prompt_merge_node,
    prompt_planner_node,
    result_packager_node,
)


def _loop_or_finish(state: LogoState) -> str:
    return "finish" if state.get("done") else "regen"


def build_graph_v2() -> StateGraph:
    g = StateGraph(LogoState)

    g.add_node("mode_selection", mode_selection_node)
    g.add_node("prompt_merge", prompt_merge_node)
    g.add_node("prompt_planner", prompt_planner_node)
    g.add_node("generation_router", generation_router_node)
    g.add_node("image_operator", image_operator_node)
    g.add_node("evaluator", evaluator_node)
    g.add_node("result_packager", result_packager_node)

    g.set_entry_point("mode_selection")

    g.add_edge("mode_selection", "prompt_merge")
    g.add_edge("prompt_merge", "prompt_planner")
    g.add_edge("prompt_planner", "generation_router")
    g.add_edge("generation_router", "image_operator")
    g.add_edge("image_operator", "evaluator")

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
