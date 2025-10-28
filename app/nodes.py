from pathlib import Path
from typing import Optional

import requests
from fastapi import HTTPException

from .config import IDEOGRAM_API_KEY, SAVE_DIR, client
from .models import LogoState
from .prompt_engine import refine_remix_prompt
from .utils import contains_korean, overlay_korean_font


def prompt_node(state: LogoState) -> LogoState:
    """
    Step 1: base_prompt 생성
    Step 2: edit_instruction이 있을 경우 기존 프롬프트를 유지하면서 최소 수정
    """
    if not state.get("edit_image_url"):
        base_prompt = (
            f"Generate a professional logo concept for '{state['brand_name']}'. "
            f"Description: {state['description']}. Style: {state['style']}."
        )
        if state.get("negative_prompt"):
            base_prompt += f" Avoid: {state['negative_prompt']}."

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
        state["base_prompt"] = refined_base
        state["prompt"] = refined_base
        return state

    base_prompt = (
        state.get("base_prompt")
        or state.get("prompt")
        or f"Generate a professional logo for '{state['brand_name']}' with style {state['style']}."
    )

    remix_prompt = refine_remix_prompt(
        base_prompt=base_prompt,
        edit_instruction=state.get("edit_instruction"),
        negative_prompt=state.get("negative_prompt"),
    )

    state["prompt"] = remix_prompt
    state["base_prompt"] = base_prompt
    return state


def generate_node(state: LogoState) -> LogoState:
    headers = {"Api-Key": IDEOGRAM_API_KEY}
    payload = {
        "prompt": state["prompt"],
        "model": "3.0-turbo",
        "num_outputs": 1,
        "aspect_ratio": "1x1",
        "cfg_scale": state.get("cfg_scale", 15.0),
    }
    resp = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/generate",
        headers=headers,
        json=payload,
        timeout=60,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=resp.text)

    image_url = resp.json()["data"][0]["url"]
    img_bytes = requests.get(image_url).content
    save_path = SAVE_DIR / f"{state['brand_name']}_original.png"
    save_path.write_bytes(img_bytes)
    state["image_url"] = image_url
    state["original_path"] = str(save_path)
    return state


def edit_node(state: LogoState) -> LogoState:
    if not state.get("edit_image_url"):
        raise HTTPException(
            status_code=400, detail="edit_image_url is required for edits"
        )

    def _load_image_bytes(source: str) -> bytes:
        if source.startswith("http"):
            response = requests.get(source, timeout=60)
            response.raise_for_status()
            return response.content
        return Path(source).read_bytes()

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
    if state.get("negative_prompt"):
        data["negative_prompt"] = state["negative_prompt"]
    if state.get("seed") is not None:
        data["seed"] = str(state["seed"])

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

    image_url = resp.json()["data"][0]["url"]
    img_bytes = requests.get(image_url, timeout=60).content
    save_path = SAVE_DIR / f"{state['brand_name']}_remix.png"
    save_path.write_bytes(img_bytes)
    state["image_url"] = image_url
    state["original_path"] = str(save_path)
    return state


def overlay_node(state: LogoState) -> LogoState:
    image_bytes = Path(state["original_path"]).read_bytes()
    overlay_path: Optional[str] = (
        overlay_korean_font(image_bytes, state["brand_name"])
        if contains_korean(state["brand_name"])
        else None
    )
    state["overlay_path"] = overlay_path
    return state
