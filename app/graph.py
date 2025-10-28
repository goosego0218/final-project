from langgraph.graph import END, StateGraph

from .models import LogoState
from .nodes import edit_node, generate_node, overlay_node, prompt_node


def _choose_branch(state: LogoState) -> str:
    return "edit" if state.get("edit_image_url") else "generate"


def build_graph() -> StateGraph:
    graph = StateGraph(LogoState)
    graph.add_node("enhance_prompt", prompt_node)
    graph.add_node("generate_logo", generate_node)
    graph.add_node("edit_logo", edit_node)
    graph.add_node("overlay_font", overlay_node)
    graph.set_entry_point("enhance_prompt")

    graph.add_conditional_edges(
        "enhance_prompt",
        _choose_branch,
        {"generate": "generate_logo", "edit": "edit_logo"},
    )
    graph.add_edge("generate_logo", "overlay_font")
    graph.add_edge("edit_logo", "overlay_font")
    graph.add_edge("overlay_font", END)
    return graph


compiled_graph = build_graph().compile()
