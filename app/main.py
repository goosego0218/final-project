from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, HTTPException

from .graph_v2 import compiled_graph_v2
from .models import LogoRequest
from .agent_schema import LogoState


app = FastAPI(title="AI Logo Maker LangGraph", version="v2 (Ideogram + Reasoning)")


@app.post("/logo_pipeline")
def run_logo_pipeline(req: LogoRequest):
    """Back-compat endpoint using the v2 graph internally and returning the
    same keys Streamlit expects (prompt/base_prompt/image_url/etc)."""
    try:
        now = datetime.utcnow()
        input_images: list[str] = []
        if req.edit_image_url:
            input_images.append(req.edit_image_url)
        if req.reference_images:
            input_images.extend(req.reference_images)

        v2_state: LogoState = {
            "request_id": "st-v2",
            "created_at": now,
            "updated_at": now,
            "brand_name": req.brand_name,
            "brand_description": req.description,
            "brand_tone": req.style or (req.style_type or ""),
            "target_usage": ["generic"],
            "input_image_urls": input_images,
            "input_mask_url": req.mask_image_url or None,
            "requested_task_type": req.image_task_mode or None,
            # Sidebar/Main prompt inputs from UI (optional)
            "prompt_keywords": req.prompt_keywords or None,
            "user_prompt": req.user_prompt or (req.base_prompt or ""),
            # 초기에는 사용자 스타일 텍스트를 그대로 프롬프트로 쓰지 않고,
            # PromptPlanner가 브랜드/설명/톤을 결합해 최종 프롬프트를 만들게 한다.
            # 사용자가 명시적으로 base_prompt를 준 경우에만 초기 프롬프트로 사용.
            "enhanced_prompt": req.base_prompt or "",
            "negative_prompt": req.negative_prompt,
            "style_tags": None,
            # Prefer style_type (Ideogram); keep style_preset for compatibility
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
            "eval_score": None,
            "eval_feedback": None,
            "human_feedback": req.edit_instruction or None,
            "next_prompt_hint": None,
            "regen_round": 0,
            "done": False,
        }

        state = compiled_graph_v2.invoke(v2_state)

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
            "eval_scores": eval_scores,
            "next_prompt_hint": state.get("next_prompt_hint"),
            "image_weight": None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/")
def root():
    return {"message": "🚀 AI Logo Maker (v2) is running!"}
