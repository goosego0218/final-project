from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from app.agents.logo_workflow import LogoState
from app.graphs.logo_workflow.graph_v2 import compiled_graph_v2
from app.schemas.logo import LogoRequest


def _build_initial_state(req: LogoRequest) -> LogoState:
    now = datetime.utcnow()
    input_images: list[str] = []
    if req.edit_image_url:
        input_images.append(req.edit_image_url)
    if req.reference_images:
        input_images.extend(req.reference_images)

    reference_logo = req.reference_logo.model_dump() if req.reference_logo else None
    targets = req.target_usage or ["generic"]

    return {
        "request_id": "st-v2",
        "created_at": now,
        "updated_at": now,
        "brand_name": req.brand_name,
        "brand_description": req.description,
        "brand_tone": req.style or (req.style_type or ""),
        "target_usage": targets,
        "logo_type": req.logo_type,
        "style_preferences": req.style_preferences,
        "trend_highlights": req.trend_highlights,
        "input_image_urls": input_images,
        "input_mask_url": req.mask_image_url or None,
        "requested_task_type": req.image_task_mode or None,
        "prompt_keywords": req.prompt_keywords or None,
        "user_prompt": req.user_prompt or (req.base_prompt or ""),
        "enhanced_prompt": req.base_prompt or "",
        "negative_prompt": req.negative_prompt,
        "style_tags": None,
        "style_type": req.style_type or None,
        "style_preset": None,
        "rendering_speed": "DEFAULT",
        "aspect_ratio": None,
        "seed": req.seed,
        "remix_strength": req.remix_strength,
        "remix_num_images": req.remix_num_images,
        "edit_inpaint_strength": req.edit_inpaint_strength,
        "edit_keep_background": req.edit_keep_background,
        "candidate_images": [],
        "last_generated_image_url": None,
        "is_image_safe": None,
        "reference_logo": reference_logo,
        "eval_score": None,
        "eval_feedback": None,
        "human_feedback": req.edit_instruction or None,
        "next_prompt_hint": None,
        "regen_round": 0,
        "done": False,
    }


def _format_eval_scores(state: LogoState) -> Dict[str, Any]:
    eval_scores = {
        "match": state.get("eval_alignment_score"),
        "typography": state.get("eval_typography_score"),
        "hangul": state.get("eval_hangul_score"),
        "negative": state.get("eval_negative_score"),
        "layout": state.get("eval_layout_score"),
        "feedback": state.get("eval_feedback_score"),
    }
    overall_norm = state.get("eval_score")
    if overall_norm is not None:
        eval_scores["overall"] = int(round(overall_norm * 100))
    return eval_scores


def run_logo_pipeline(req: LogoRequest) -> Dict[str, Any]:
    """
    Execute the compiled LangGraph pipeline for logo generation and map the
    resulting graph state into the legacy response shape consumed by frontend.
    """
    initial_state = _build_initial_state(req)
    state = compiled_graph_v2.invoke(initial_state)
    return {
        "prompt": state.get("enhanced_prompt"),
        "base_prompt": state.get("enhanced_prompt"),
        "image_url": state.get("last_generated_image_url"),
        "original_logo": state.get("last_generated_image_url"),
        "final_logo": None,
        "negative_prompt": state.get("negative_prompt"),
        "prompt_history": [],
        "remix_attempts": state.get("regen_round"),
        "regen_attempts": state.get("regen_round"),
        "regen_history": state.get("regen_history"),
        "eval_feedback": state.get("eval_feedback"),
        "eval_scores": _format_eval_scores(state),
        "next_prompt_hint": state.get("next_prompt_hint"),
        "image_weight": None,
        "task_type": state.get("task_type"),
        "task_reason": state.get("task_reason"),
    }
