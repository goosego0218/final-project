from langgraph.graph import StateGraph
from .state import LogoState
from .nodes import (
    select_type_node,
    load_reference_node,
    generate_node,
    finalize_node
)

def build_logo_workflow():
    graph = StateGraph(LogoState)

    graph.add_node("select_type", select_type_node)
    graph.add_node("load_reference", load_reference_node)
    graph.add_node("generate", generate_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("select_type")
    graph.add_edge("select_type", "load_reference")
    graph.add_edge("load_reference", "generate")
    graph.add_edge("generate", "finalize")

    return graph.compile()
