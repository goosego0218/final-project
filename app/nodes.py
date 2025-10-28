import json
from pathlib import Path
from typing import Optional

import requests
from fastapi import HTTPException
from langgraph.errors import EmptyChannelError

from .config import IDEOGRAM_API_KEY, SAVE_DIR, client
from .models import LogoState, PromptHistoryEntry
from .palette import suggest_color_palette
from .prompt_engine import refine_remix_prompt
from .utils import contains_korean, make_safe_filename, overlay_korean_font

DEFAULT_IMAGE_WEIGHT = 70


def _load_image_bytes(source: str) -> bytes:
    if source.startswith("http"):
        response = requests.get(source, timeout=60)
        response.raise_for_status()
        return response.content
    return Path(source).read_bytes()


def _detect_mime_type(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".webp":
        return "image/webp"
    return "image/png"


def _get_prompt_history(state: LogoState) -> list[PromptHistoryEntry]:
    try:
        history = state.get("prompt_history")  # type: ignore[index]
    except EmptyChannelError:
        return []
    if not history:
        return []
    return list(history)


def prompt_node(state: LogoState) -> LogoState:
    history = _get_prompt_history(state)
    brand = state["brand_name"]
    updates: LogoState = {}

    if not state.get("edit_image_url"):
        base_prompt = (
            f"Generate a professional logo concept for '{brand}'. "
            f"Description: {state['description']}. Style: {state['style']}."
        )
        negative = state.get("negative_prompt")
        if negative:
            base_prompt += f" Avoid: {negative}."

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional logo prompt engineer.",
                },
                {"role": "user", "content": base_prompt},
            ],
        )
        refined_base = completion.choices[0].message.content.strip()
        updates["base_prompt"] = refined_base
        updates["prompt"] = refined_base
        updates["prompt_history"] = [
            {"stage": "generate", "prompt": refined_base, "edit_instruction": None}
        ]
        return updates

    if state.get("skip_prompt_refine"):
        edit_instruction = state.get("edit_instruction")
        if not edit_instruction:
            raise HTTPException(
                status_code=400,
                detail="edit_instruction is required when skipping prompt refinement",
            )
        updates["prompt"] = edit_instruction
        updates["base_prompt"] = state.get("base_prompt", edit_instruction)
        updates["prompt_history"] = [
            {
                "stage": "image_edit",
                "prompt": edit_instruction,
                "edit_instruction": edit_instruction,
            }
        ]
        return updates

    base_prompt = (
        state.get("base_prompt")
        or state.get("prompt")
        or f"Generate a professional logo for '{brand}' with style {state['style']}."
    )

    remix_prompt = refine_remix_prompt(
        base_prompt=base_prompt,
        edit_instruction=state.get("edit_instruction"),
        negative_prompt=state.get("negative_prompt"),
        previous_changes=history,
    )

    updates["prompt"] = remix_prompt
    updates["base_prompt"] = base_prompt
    updates["prompt_history"] = [
        {
            "stage": "remix",
            "prompt": remix_prompt,
            "edit_instruction": state.get("edit_instruction"),
        }
    ]
    return updates


def palette_node(state: LogoState) -> LogoState:
    if state.get("edit_image_url"):
        return {}
    if state.get("color_palette"):
        return {}
    if not state.get("enable_palette_suggestion", True):
        return {}

    try:
        suggestion = suggest_color_palette(
            brand_name=state["brand_name"],
            description=state.get("description") or "",
            style=state.get("style") or "",
        )
    except Exception as exc:
        print(f"[Palette Suggestion Error] {exc}")
        return {}

    if suggestion:
        return {"color_palette": suggestion}
    return {}


def generate_node(state: LogoState) -> LogoState:
    headers = {"Api-Key": IDEOGRAM_API_KEY}
    payload = {
        "prompt": state["prompt"],
        "model": "3.0-turbo",
        "num_outputs": 1,
        "aspect_ratio": "1x1",
        "cfg_scale": state.get("cfg_scale", 15.0),
    }
    files: list[tuple[str, tuple[str, bytes, str]]] = []
    data: dict[str, str] | None = None

    character_refs = state.get("character_reference_images") or []
    if character_refs:
        data = {k: str(v) if not isinstance(v, str) else v for k, v in payload.items()}
        for image_path in character_refs:
            try:
                image_bytes = _load_image_bytes(image_path)
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to load character reference image '{image_path}': {exc}",
                )
            files.append(
                (
                    "character_reference_images",
                    (Path(image_path).name, image_bytes, _detect_mime_type(image_path)),
                )
            )
        payload = {}

    target = data if files else payload
    negative = state.get("negative_prompt")
    if negative:
        target["negative_prompt"] = negative
    if state.get("style_type"):
        target["style_type"] = state["style_type"]
    if state.get("seed") is not None:
        target["seed"] = state["seed"]
    if state.get("color_palette"):
        palette_payload = state["color_palette"]
        if files:
            target["color_palette"] = json.dumps(palette_payload)
        else:
            payload["color_palette"] = palette_payload

    resp = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/generate",
        headers=headers,
        json=payload if not files else None,
        data=data,
        files=files if files else None,
        timeout=60,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=resp.text)

    image_url = resp.json()["data"][0]["url"]
    img_bytes = requests.get(image_url, timeout=60).content
    safe_name = make_safe_filename(state["brand_name"])
    save_path = SAVE_DIR / f"{safe_name}_original.png"
    save_path.write_bytes(img_bytes)
    return {
        "image_url": image_url,
        "original_path": str(save_path),
    }


def edit_node(state: LogoState) -> LogoState:
    if not state.get("edit_image_url"):
        raise HTTPException(
            status_code=400, detail="edit_image_url is required for edits"
        )

    prompt = state.get("prompt") or state.get("base_prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Unable to compose remix prompt")

    files = {
        "image": ("input.png", _load_image_bytes(state["edit_image_url"]), "image/png")
    }
    data = {
        "prompt": prompt,
        "rendering_speed": "DEFAULT",
        "style_type": state.get("style_type") or "GENERAL",
    }
    negative = state.get("negative_prompt")
    if negative:
        data["negative_prompt"] = negative
    if state.get("seed") is not None:
        data["seed"] = str(state["seed"])
    current_weight = state.get("image_weight")
    if current_weight is not None:
        data["image_weight"] = str(current_weight)

    headers = {"Api-Key": IDEOGRAM_API_KEY}
    resp = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/remix",
        headers=headers,
        data=data,
        files=files,
        timeout=60,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=resp.text)

    body = resp.json()
    image_url = body["data"][0]["url"]
    img_bytes = requests.get(image_url, timeout=60).content
    safe_name = make_safe_filename(state["brand_name"])
    save_path = SAVE_DIR / f"{safe_name}_remix.png"
    save_path.write_bytes(img_bytes)

    attempts = state.get("remix_attempts", 0) + 1
    max_retries = max(0, state.get("remix_max_retries", 1))
    auto_retry = state.get("auto_retry_remix", True)

    should_retry = (
        auto_retry
        and attempts <= max_retries
        and (current_weight or DEFAULT_IMAGE_WEIGHT) < 90
        and bool(state.get("edit_instruction"))
    )

    updates: LogoState = {
        "image_url": image_url,
        "original_path": str(save_path),
        "remix_attempts": attempts,
        "needs_retry": should_retry,
    }
    return updates


def prepare_remix_retry(state: LogoState) -> LogoState:
    current_weight = state.get("image_weight") or DEFAULT_IMAGE_WEIGHT
    boosted = min(100, max(current_weight, DEFAULT_IMAGE_WEIGHT) + 20)
    return {
        "image_weight": boosted,
        "needs_retry": False,
    }


def overlay_node(state: LogoState) -> LogoState:
    image_bytes = Path(state["original_path"]).read_bytes()
    overlay_path: Optional[str] = (
        overlay_korean_font(image_bytes, state["brand_name"])
        if contains_korean(state["brand_name"])
        else None
    )
    return {"overlay_path": overlay_path}
