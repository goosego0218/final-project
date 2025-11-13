from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query

from .graph_v2 import compiled_graph_v2
from .models import LogoRequest, TaskModeRequest
from .agent_schema import LogoState
from .library import query_logo_library
from .recommendations import recommend_logos
from .task_classifier import classify_task_mode


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

        reference_logo = req.reference_logo.model_dump() if req.reference_logo else None
        targets = req.target_usage or ["generic"]

        v2_state: LogoState = {
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
            # Sidebar/Main prompt inputs from UI (optional)
            "prompt_keywords": req.prompt_keywords or None,
            "user_prompt": req.user_prompt or (req.base_prompt or ""),
            # 珥덇린?먮뒗 ?ъ슜???ㅽ????띿뒪?몃? 洹몃?濡??꾨＼?꾪듃濡??곗? ?딄퀬,
            # PromptPlanner媛 釉뚮옖???ㅻ챸/?ㅼ쓣 寃고빀??理쒖쥌 ?꾨＼?꾪듃瑜?留뚮뱾寃??쒕떎.
            # ?ъ슜?먭? 紐낆떆?곸쑝濡?base_prompt瑜?以 寃쎌슦?먮쭔 珥덇린 ?꾨＼?꾪듃濡??ъ슜.
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
            "reference_logo": reference_logo,
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
            "task_type": state.get("task_type"),
            "task_reason": state.get("task_reason"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/")
def root():
    return {"message": "AI Logo Maker (v2) is running!"}


@app.get("/logo_library")
def logo_library(
    logo_type: Optional[str] = Query(None, description="Filter by symbol/category"),
    style_tag: Optional[str] = Query(None, description="Filter by style tag"),
    limit: int = Query(24, ge=1, le=200),
    refresh: bool = Query(False, description="Force reload from disk"),
):
    entries = query_logo_library(
        logo_type=logo_type, style_tag=style_tag, limit=limit, refresh=refresh
    )
    return {"items": [entry.model_dump() for entry in entries]}


@app.get("/logo_recommendations")
def logo_recommendations(
    seed_id: str = Query(..., description="ID or filename stem of the reference logo"),
    limit: int = Query(8, ge=1, le=40),
    offset: int = Query(0, ge=0),
):
    """
    Return semantically similar logos based on the precomputed JSON+RAG embeddings.
    Requires running `scripts/build_logo_embeddings.py` at least once (or rely on
    the fallback bag-of-words vectors).
    """
    result = recommend_logos(seed_id=seed_id, limit=limit, offset=offset)
    return result


@app.post("/task_mode")
def task_mode(req: TaskModeRequest):
    mode, reason = classify_task_mode(
        req.prompt,
        has_reference=req.has_reference,
        has_mask=req.has_mask,
        has_recent_reuse=req.recent_image_reuse,
    )
    return {"mode": mode, "reason": reason}

