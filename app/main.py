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

        return {
            "prompt": state.get("enhanced_prompt"),
            "base_prompt": state.get("enhanced_prompt"),
            "image_url": state.get("last_generated_image_url"),
            "original_logo": state.get("last_generated_image_url"),
            "final_logo": None,
            "negative_prompt": state.get("negative_prompt"),
            "prompt_history": [],
            "remix_attempts": state.get("regen_round"),
            "image_weight": None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/")
def root():
    return {"message": "🚀 AI Logo Maker (v2) is running!"}
