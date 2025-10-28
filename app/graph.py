from langgraph.graph import END, StateGraph

from .models import LogoState
from .nodes import (
    edit_node,
    generate_node,
    overlay_node,
    palette_node,
    prepare_remix_retry,
    prompt_node,
)


def _choose_branch(state: LogoState) -> str:
    if state.get("edit_image_url"):
        return "edit"
    if state.get("character_reference_images"):
        return "character_reference"
    return "generate"


def _generation_target(state: LogoState) -> str:
    if state.get("character_reference_images"):
        return "character_reference"
    return "generate"


def _post_edit_branch(state: LogoState) -> str:
    return "retry" if state.get("needs_retry") else "done"


def build_graph() -> StateGraph:
    graph = StateGraph(LogoState)
    graph.add_node("enhance_prompt", prompt_node)
    graph.add_node("recommend_palette", palette_node)
    graph.add_node("generate_logo", generate_node)
    graph.add_node("generate_logo_with_reference", generate_node)
    graph.add_node("edit_logo", edit_node)
    graph.add_node("prepare_remix_retry", prepare_remix_retry)
    graph.add_node("overlay_font", overlay_node)
    graph.set_entry_point("enhance_prompt")

    graph.add_conditional_edges(
        "enhance_prompt",
        _choose_branch,
        {
            "generate": "recommend_palette",
            "character_reference": "recommend_palette",
            "edit": "edit_logo",
        },
    )

    graph.add_conditional_edges(
        "recommend_palette",
        _generation_target,
        {
            "generate": "generate_logo",
            "character_reference": "generate_logo_with_reference",
        },
    )
    graph.add_edge("generate_logo", "overlay_font")
    graph.add_edge("generate_logo_with_reference", "overlay_font")

    graph.add_conditional_edges(
        "edit_logo",
        _post_edit_branch,
        {
            "retry": "prepare_remix_retry",
            "done": "overlay_font",
        },
    )
    graph.add_edge("prepare_remix_retry", "edit_logo")
    graph.add_edge("overlay_font", END)
    return graph


compiled_graph = build_graph().compile()
