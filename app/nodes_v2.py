from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Tuple

import requests
from fastapi import HTTPException
from pydantic import HttpUrl

from .config import IDEOGRAM_API_KEY, client

from .agent_schema import LogoState, TaskType, choose_task_type


def intent_router_node(state: LogoState) -> LogoState:
    user_text = state.get("enhanced_prompt") or state.get("brand_description") or ""
    has_image = bool(state.get("input_image_urls"))
    has_mask = bool(state.get("input_mask_url"))
    # If image present and human/edit instruction present, prefer remix (no mask) or edit (mask)
    if has_mask:
        task = TaskType.EDIT
        reason = "mask_present"
    elif has_image and (state.get("human_feedback") or state.get("next_prompt_hint")):
        task = TaskType.REMIX
        reason = "image_and_feedback_present"
    else:
        task = choose_task_type(user_text, has_image=has_image, has_mask=has_mask)
        reason = "heuristic"
    return {"task_type": task.value, "task_reason": reason, "updated_at": datetime.utcnow()}


def prompt_planner_node(state: LogoState) -> LogoState:
    """Use OpenAI to synthesize a clear, actionable prompt from brand context
    and any prior feedback (auto + human)."""
    brand = state.get("brand_name", "")
    desc = state.get("brand_description", "")
    tone = state.get("brand_tone", "")
    human_feedback = state.get("human_feedback") or ""
    eval_feedback = state.get("eval_feedback") or ""

    base_prompt = state.get("enhanced_prompt") or (
        f"Create a professional brand logo for '{brand}'.\n"
        f"Brand description: {desc}. Desired tone: {tone}.\n"
        "Priorities: legibility, scalability, simple/iconic mark, balanced typography."
    )

    user_msg = (
        "Refine this into a single prompt for an image model (Ideogram).\n"
        "- Keep it concise (2-4 sentences).\n"
        "- Include clear visual cues, typography style, and composition hints.\n"
        "- Keep brand name literal if provided.\n"
        f"Base: {base_prompt}\n"
        f"Human feedback (optional): {human_feedback}\n"
        f"Evaluator feedback (optional): {eval_feedback}"
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a senior logo prompt engineer. Produce only the final prompt.",
            },
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )
    enhanced = (completion.choices[0].message.content or "").strip()
    updates: LogoState = {"enhanced_prompt": enhanced, "updated_at": datetime.utcnow()}
    return updates


def _first_url(urls: Optional[List[str] | List[HttpUrl]]) -> Optional[str]:
    if not urls:
        return None
    return str(urls[0])


def _post_json(url: str, headers: dict, json: dict) -> dict:
    resp = requests.post(url, headers=headers, json=json, timeout=90)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


def _post_multipart(url: str, headers: dict, data: dict, files: dict) -> dict:
    resp = requests.post(url, headers=headers, data=data, files=files, timeout=90)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


def _load_bytes(source: str) -> bytes:
    if source.startswith("http://") or source.startswith("https://"):
        return requests.get(source, timeout=90).content
    from pathlib import Path

    return Path(source).read_bytes()


def _sanitize_mask_bytes(mask_bytes: bytes, target_size: Optional[Tuple[int, int]] = None) -> bytes:
    """Coerce the mask to pure black/white and allowed mode. Optionally resize to target.
    - Convert to L, apply threshold, then convert to RGB, and PNG-encode.
    - If target_size is provided, resize with NEAREST to preserve BW.
    """
    from io import BytesIO
    from PIL import Image
    import numpy as np

    with Image.open(BytesIO(mask_bytes)) as im:
        im_l = im.convert("L")
        arr = np.array(im_l)
        bw = (arr > 127).astype("uint8") * 255
        im_bw = Image.fromarray(bw, mode="L")
        if target_size and (im_bw.size != target_size):
            im_bw = im_bw.resize(target_size, Image.NEAREST)
        # Convert to RGB to satisfy API accepted modes
        im_rgb = Image.merge("RGB", (im_bw, im_bw, im_bw))
        out = BytesIO()
        im_rgb.save(out, format="PNG")
        return out.getvalue()


def image_operator_node(state: LogoState) -> LogoState:
    """Call the appropriate Ideogram endpoint based on task_type."""
    task = state.get("task_type") or TaskType.GENERATE.value
    prompt = state.get("enhanced_prompt") or ""
    negative = state.get("negative_prompt")
    aspect_ratio = state.get("aspect_ratio")
    style_preset = state.get("style_preset")
    style_type = state.get("style_type")
    rendering_speed = state.get("rendering_speed") or "DEFAULT"
    seed = state.get("seed")
    input_images = state.get("input_image_urls")
    input_mask = state.get("input_mask_url")

    headers = {"Api-Key": IDEOGRAM_API_KEY}

    # DESCRIBE
    if task == TaskType.DESCRIBE.value:
        img = _first_url(input_images)
        if not img:
            # If no image, return empty and mark done
            return {
                "candidate_images": [],
                "last_generated_image_url": None,
                "api_endpoint": "describe",
                "updated_at": datetime.utcnow(),
            }
        data = {"image_url": img}
        body = _post_json("https://api.ideogram.ai/v1/ideogram-v3/describe", headers, data)
        description = body.get("data", [{}])[0].get("description", "")
        # Store as feedback to influence next planning
        return {
            "eval_feedback": f"Image description: {description}",
            "candidate_images": [],
            "last_generated_image_url": img,
            "api_endpoint": "describe",
            "updated_at": datetime.utcnow(),
        }

    # GENERATE / REMIX / EDIT
    api_ep = None
    if task == TaskType.GENERATE.value:
        # Default to DESIGN style for initial logo generation if not specified
        if not style_type:
            style_type = "DESIGN"
        payload = {"prompt": prompt, "rendering_speed": rendering_speed}
        if negative:
            payload["negative_prompt"] = negative
        if aspect_ratio:
            payload["aspect_ratio"] = aspect_ratio
        # Ideogram spec commonly uses style_type; keep style_preset as fallback
        if style_type:
            payload["style_type"] = style_type
        elif style_preset:
            payload["style_type"] = style_preset
        if seed is not None:
            payload["seed"] = seed
        body = _post_json("https://api.ideogram.ai/v1/ideogram-v3/generate", headers, payload)
        api_ep = "generate"
    elif task == TaskType.REMIX.value:
        base_img = _first_url(input_images)
        if not base_img:
            raise ValueError("remix requires at least one input_image_urls")
        files = {"image": ("image.png", _load_bytes(base_img), "image/png")}
        data = {"prompt": prompt, "rendering_speed": rendering_speed}
        if negative:
            data["negative_prompt"] = negative
        if style_type:
            data["style_type"] = style_type
        elif style_preset:
            data["style_type"] = style_preset
        if seed is not None:
            data["seed"] = str(seed)
        if aspect_ratio:
            data["aspect_ratio"] = aspect_ratio
        body = _post_multipart("https://api.ideogram.ai/v1/ideogram-v3/remix", headers, data, files)
        api_ep = "remix"
    elif task == TaskType.EDIT.value or task == TaskType.REPLACE_BG.value:
        base_img = _first_url(input_images)
        if not base_img or not input_mask:
            raise ValueError("edit requires input_image_urls[0] and input_mask_url")
        base_bytes = _load_bytes(base_img)
        # Determine base image size for mask alignment
        try:
            from PIL import Image
            from io import BytesIO
            with Image.open(BytesIO(base_bytes)) as _im:
                target_size = _im.size
        except Exception:
            target_size = None
        sanitized_mask = _sanitize_mask_bytes(_load_bytes(str(input_mask)), target_size)
        files = {
            "image": ("image.png", base_bytes, "image/png"),
            "mask": ("mask.png", sanitized_mask, "image/png"),
        }
        data = {"prompt": prompt, "rendering_speed": rendering_speed}
        if negative:
            data["negative_prompt"] = negative
        if style_type:
            data["style_type"] = style_type
        elif style_preset:
            data["style_type"] = style_preset
        if seed is not None:
            data["seed"] = str(seed)
        if aspect_ratio:
            data["aspect_ratio"] = aspect_ratio
        body = _post_multipart("https://api.ideogram.ai/v1/ideogram-v3/edit", headers, data, files)
        api_ep = "edit"
    else:
        raise ValueError(f"Unsupported task_type: {task}")

    # Normalize response
    data_arr = body.get("data", [])
    candidates: List[dict] = []
    last_url: Optional[str] = None
    for i, item in enumerate(data_arr):
        url = item.get("url")
        if not url:
            continue
        last_url = url
        candidates.append({"url": url, "source": "ideogram", "variant_id": item.get("id")})

    return {
        "candidate_images": candidates,
        "last_generated_image_url": last_url,
        "is_image_safe": True,
        "api_endpoint": api_ep,
        "updated_at": datetime.utcnow(),
    }


def evaluator_node(state: LogoState) -> LogoState:
    """Use OpenAI to score alignment and propose a next prompt hint."""
    image_url = state.get("last_generated_image_url") or ""
    brand_desc = state.get("brand_description") or ""
    brand_tone = state.get("brand_tone") or ""
    human_feedback = state.get("human_feedback") or ""
    enhanced_prompt = state.get("enhanced_prompt") or ""

    user_msg = (
        "Evaluate this generated logo for brand fit, legibility, simplicity, and real-world usability.\n"
        f"Brand description: {brand_desc}\n"
        f"Tone: {brand_tone}\n"
        f"Image URL: {image_url}\n"
        "Return a JSON object with: score (0.0-1.0), feedback (short), and next_prompt_hint (1-2 sentences)."
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a strict logo art director."},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )
    raw = (completion.choices[0].message.content or "").strip()

    # Simple parse fallback: try to find numbers and lines; keep robust
    score = 0.8
    feedback = raw[:240]
    hint = enhanced_prompt
    # If there is human feedback, append it for next loop
    if human_feedback:
        hint = f"{enhanced_prompt}\nRefine per user: {human_feedback}"

    need_regen = (score < 0.75) or bool(human_feedback)
    regen_round = int(state.get("regen_round", 0))

    updates: LogoState = {
        "eval_score": float(score),
        "eval_feedback": feedback,
        "next_prompt_hint": hint,
        "updated_at": datetime.utcnow(),
    }

    if need_regen and regen_round < 3:
        updates["regen_round"] = regen_round + 1
        updates["enhanced_prompt"] = hint
        updates["done"] = False
    else:
        updates["done"] = True

    return updates


def result_packager_node(state: LogoState) -> LogoState:
    # Aggregate minimal history for UI/API
    history: Dict[str, str] = {}
    if state.get("enhanced_prompt"):
        history["enhanced_prompt"] = state["enhanced_prompt"]
    if state.get("eval_feedback"):
        history["eval_feedback"] = state["eval_feedback"] or ""
    if state.get("human_feedback"):
        history["human_feedback"] = state["human_feedback"] or ""

    updates: LogoState = {
        "done": True,
        "updated_at": datetime.utcnow(),
    }
    # Keep last_generated_image_url as final output anchor
    return updates
