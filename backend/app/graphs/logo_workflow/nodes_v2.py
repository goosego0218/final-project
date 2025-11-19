from __future__ import annotations

import base64
import mimetypes
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from fastapi import HTTPException
from pydantic import BaseModel, Field, HttpUrl
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langsmith import trace

from app.agents.logo_workflow import ImageOperatorOut, LogoState, PromptPlannerOut, TaskType
from app.core.logo_settings import (
    LANGCHAIN_PROJECT,
    OPENAI_API_KEY,
)
from app.services.logo_ideogram import (
    IdeogramGenerateTool,
    IdeogramRemixTool,
    IdeogramEditTool,
    IdeogramReplaceBackgroundTool,
)


_generate_tool = IdeogramGenerateTool()
_remix_tool = IdeogramRemixTool()
_edit_tool = IdeogramEditTool()
_replace_bg_tool = IdeogramReplaceBackgroundTool()


_PLANNER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a senior logo prompt engineer for Ideogram."
                " Output only the final refined prompt (2-4 sentences)."
                " Always keep the brand name literal, emphasize composition,"
                " typography, color cues, and remind the model about remix/edit constraints."
            ),
        ),
        (
            "user",
            (
                "Task: {task}\n"
                "Instruction: {instruction}\n"
                "Brand context: {brand_context}\n"
                "Base prompt: {base_prompt}\n"
                "Human feedback: {human_feedback}\n"
                "Evaluator feedback: {eval_feedback}\n"
                "Next hint: {next_hint}"
            ),
        ),
    ]
)
_PLANNER_PARSER = StrOutputParser()

_EVALUATOR_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a strict logo art director."
                " Score the provided logo on: (1) match to the latest user request/keywords,"
                " (2) legibility & typography clarity, (3) Korean (Hangul) rendering quality when required,"
                " (4) compliance with any negative prompt or forbidden motifs / safety rules,"
                " (5) composition/layout fidelity (aspect ratio, spacing), and"
                " (6) responsiveness to recent human/evaluator feedback."
                " Respond using EXACTLY the following lines (one per metric) with integers 0-100:\n"
                "SCORE_MATCH: <int>\n"
                "SCORE_TYPO: <int>\n"
                "SCORE_HANGUL: <int>\n"
                "SCORE_NEGATIVE: <int>\n"
                "SCORE_LAYOUT: <int>\n"
                "SCORE_FEEDBACK: <int>\n"
                "SCORE_OVERALL: <int>\n"
                "FEEDBACK: <short critique>\n"
                "HINT: <actionable revision hint>"
            ),
        ),
        (
            "user",
            (
                "Brand description: {brand_description}\n"
                "Tone: {brand_tone}\n"
                "User intent: {user_intent}\n"
                "Prompt keywords: {keywords}\n"
                "Negative prompt directives: {negative_prompt}\n"
                "Layout / aspect expectations: {layout}\n"
                "Safety / compliance notes: {safety_notes}\n"
                "Latest human/evaluator feedback: {feedback_summary}\n"
                "Use the attached image as the reference output."
            ),
        ),
    ]
)


class EvaluatorScores(BaseModel):
    """Structured evaluator output ensuring consistent scoring."""

    score_match: int = Field(
        ...,
        ge=0,
        le=100,
        description="How well the image matches the latest user request and keywords.",
    )
    score_typo: int = Field(
        ...,
        ge=0,
        le=100,
        description="Legibility and typography clarity.",
    )
    score_hangul: int = Field(
        ...,
        ge=0,
        le=100,
        description="Quality of Korean (Hangul) rendering, set 100 if not applicable.",
    )
    score_negative: int = Field(
        ...,
        ge=0,
        le=100,
        description="Compliance with negative prompts, forbidden motifs, and safety rules.",
    )
    score_layout: int = Field(
        ...,
        ge=0,
        le=100,
        description="Composition/layout fidelity (aspect ratio, spacing, balance).",
    )
    score_feedback: int = Field(
        ...,
        ge=0,
        le=100,
        description="Responsiveness to the latest human/evaluator feedback.",
    )
    score_overall: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall readiness score considering all criteria.",
    )
    feedback: str = Field(
        ...,
        description="Short critique summarizing the issues found.",
    )
    hint: str = Field(
        ...,
        description="Actionable next-step hint for improving the logo.",
    )


def _lc_config(tags: List[str]) -> RunnableConfig:
    config: RunnableConfig = {"tags": tags}
    if LANGCHAIN_PROJECT:
        config["metadata"] = {"project": LANGCHAIN_PROJECT}
    return config


_PLANNER_CHAIN_CONFIG = _lc_config(["logo", "prompt_planner"])
_EVALUATOR_CHAIN_CONFIG = _lc_config(["logo", "evaluator"])

_planner_llm: Optional[ChatOpenAI] = None
_evaluator_llm: Optional[ChatOpenAI] = None

_EVAL_KEY_MAP = {
    "score_match": "eval_alignment_score",
    "score_typo": "eval_typography_score",
    "score_hangul": "eval_hangul_score",
    "score_negative": "eval_negative_score",
    "score_layout": "eval_layout_score",
    "score_feedback": "eval_feedback_score",
    "score_overall": "eval_score",
}
_EVAL_DEFAULT_SCORE = 80
_REGEN_THRESHOLDS = {
    "score_overall": 70,
    "score_match": 65,
    "score_typo": 60,
    "score_hangul": 60,
    "score_negative": 60,
    "score_layout": 60,
}
_PLANNER_FORBIDDEN_SNIPPETS = [
    "api_key",
    "sk-",
    "SECRET",
    "PASSWORD",
    "<<",
    "```json",
    "SYSTEM:",
    "policy",
]
_PLANNER_MAX_ATTEMPTS = 2
_EVALUATOR_MAX_ATTEMPTS = 2


def _get_planner_llm() -> ChatOpenAI:
    global _planner_llm
    if _planner_llm is None:
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="OPENAI_API_KEY is required to run the prompt planner.",
            )
        _planner_llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.3,
            api_key=OPENAI_API_KEY,
            max_retries=2,
        )
    return _planner_llm


def _get_evaluator_llm() -> ChatOpenAI:
    global _evaluator_llm
    if _evaluator_llm is None:
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="OPENAI_API_KEY is required to run the evaluator.",
            )
        _evaluator_llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.2,
            api_key=OPENAI_API_KEY,
            max_retries=2,
        )
    return _evaluator_llm


def _keyword_string(keywords: Optional[List[str]]) -> str:
    if not keywords:
        return ""
    cleaned = [k.strip() for k in keywords if k and k.strip()]
    return ", ".join(cleaned)


def _brand_context(brand: str, description: str, tone: str) -> str:
    segments = []
    if brand:
        segments.append(f"Brand: {brand}.")
    if description:
        segments.append(f"Description: {description}.")
    if tone:
        segments.append(f"Tone: {tone}.")
    return " ".join(segments)


def _task_instruction_text(task: str) -> str:
    if task == TaskType.GENERATE.value:
        return "Create a professional, legible, and iconic logo from scratch."
    if task == TaskType.REMIX.value:
        return "Remix the supplied logo while keeping overall composition and iconography unless the user overrides it."
    if task == TaskType.EDIT.value:
        return (
            "Edit only the masked region and preserve unmasked design details exactly."
        )
    if task == TaskType.REPLACE_BG.value:
        return "Replace the background only; maintain typography and mark."
    return "Prepare a succinct Ideogram-ready prompt."


def _task_base_prompt(
    task: str,
    user_prompt: str,
    keyword_text: str,
) -> str:
    kw_section = f"Keywords: {keyword_text}. " if keyword_text else ""
    if task == TaskType.GENERATE.value:
        return f"{kw_section}{user_prompt}".strip()
    if task == TaskType.REMIX.value:
        return (
            "Remix the input image while preserving overall composition unless explicitly overridden. "
            f"{'Apply: ' + user_prompt + '. ' if user_prompt else ''}"
            f"{kw_section}"
        ).strip()
    if task == TaskType.EDIT.value:
        return (
            "Edit only masked regions. Preserve unmasked areas. "
            f"{'Apply: ' + user_prompt + '. ' if user_prompt else ''}"
            f"{kw_section}"
        ).strip()
    if task == TaskType.REPLACE_BG.value:
        return (
            "Replace only the background. Keep icons and typography untouched. "
            f"{'Apply: ' + user_prompt + '. ' if user_prompt else ''}"
            f"{kw_section}"
        ).strip()
    return user_prompt


def _guard_planner_output(prompt: str) -> str:
    """Basic guardrail: ensure prompt is non-empty, bounded, and free of obvious secrets."""
    if not prompt or not prompt.strip():
        raise ValueError("Planner returned empty prompt.")
    sanitized = prompt.strip()
    if len(sanitized) > 900:
        sanitized = sanitized[:900].rstrip() + "..."
    lowered = sanitized.lower()
    for snippet in _PLANNER_FORBIDDEN_SNIPPETS:
        if snippet.lower() in lowered:
            raise ValueError(f"Disallowed content detected: {snippet}")
    return sanitized


def _image_part_from_source(source: str) -> Optional[dict]:
    if source.startswith("http://") or source.startswith("https://"):
        return {"type": "image_url", "image_url": {"url": source}}
    try:
        data = _load_bytes(source)
    except Exception:
        return None
    mime, _ = mimetypes.guess_type(source)
    if not mime:
        mime = "image/png"
    encoded = base64.b64encode(data).decode("utf-8")
    data_uri = f"data:{mime};base64,{encoded}"
    return {"type": "image_url", "image_url": {"url": data_uri}}


def _attach_image_to_messages(messages: List, image_url: str) -> List:
    if not image_url or not messages:
        return messages
    last = messages[-1]
    if not isinstance(last, HumanMessage):
        return messages
    base_content = last.content
    if isinstance(base_content, str):
        content_list: List[dict] = [{"type": "text", "text": base_content}]
    else:
        content_list = list(base_content)
    media_part = _image_part_from_source(image_url)
    if media_part:
        content_list.append(media_part)
    else:
        content_list.append(
            {"type": "text", "text": f"Image URL (fallback): {image_url}"}
        )
    messages[-1] = HumanMessage(content=content_list)
    return messages


def mode_selection_node(state: LogoState) -> LogoState:
    """Set the Ideogram task mode explicitly from the request payload."""

    requested = state.get("requested_task_type")
    if requested:
        try:
            selected = TaskType(requested)
            reason = "requested_mode"
        except ValueError:
            selected = TaskType.GENERATE
            reason = "invalid_requested_mode"
    else:
        selected = TaskType.GENERATE
        reason = "default_mode"

    return {
        "task_type": selected.value,
        "task_reason": reason,
        "updated_at": datetime.utcnow(),
    }


def _prepare_image_for_api(source: Optional[str]) -> Optional[str]:
    if not source:
        return None
    source = str(source)
    if source.startswith(("http://", "https://", "data:")):
        return source
    path = Path(source)
    if not path.exists():
        return None
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def prompt_merge_node(state: LogoState) -> LogoState:
    """Merge user prompt, style references, and brand cues."""

    style_prompt = (state.get("style_reference_prompt") or "").strip()
    user_prompt = (state.get("user_prompt") or "").strip()
    human_feedback = (state.get("human_feedback") or "").strip()
    next_hint = (state.get("next_prompt_hint") or "").strip()
    brand_desc = (state.get("brand_description") or "").strip()
    brand_tone = (state.get("brand_tone") or "").strip()
    lines: List[str] = []
    if style_prompt:
        lines.append(f"Style inspiration: {style_prompt}")
    if user_prompt:
        lines.append(f"Transform request: {user_prompt}")
    if brand_desc:
        lines.append(f"Brand story: {brand_desc}")
    if brand_tone:
        lines.append(f"Brand tone: {brand_tone}")
    if human_feedback:
        lines.append(f"Human feedback: {human_feedback}")
    if next_hint:
        lines.append(f"Evaluator hint: {next_hint}")

    merged_prompt = "\n".join(line for line in lines if line).strip()
    if not merged_prompt:
        merged_prompt = user_prompt or brand_desc

    with trace(
        "prompt_merge",
        run_type="tool",
        inputs={
            "user_prompt": user_prompt,
            "human_feedback": human_feedback,
            "style_reference_prompt": style_prompt,
            "brand_description": brand_desc,
        },
        metadata={"node": "prompt_merge"},
    ) as run:
        planner_out = PromptPlannerOut(enhanced_prompt=merged_prompt or "")
        updates: LogoState = planner_out.model_dump(exclude_none=True)
        updates["merged_prompt"] = merged_prompt
        updates["updated_at"] = datetime.utcnow()
        run.add_outputs({"merged_prompt": merged_prompt})
        run.add_metadata({"result": "merged"})
        return updates


def _dedupe_preserve(items: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for item in items:
        if not item:
            continue
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def generation_router_node(state: LogoState) -> LogoState:
    """Decide final Ideogram mode (generate/remix/edit/style) and prep inputs."""

    current_task = state.get("task_type") or TaskType.GENERATE.value
    try:
        task_enum = TaskType(current_task)
    except ValueError:
        task_enum = TaskType.GENERATE

    prepared_inputs: List[str] = []
    if state.get("input_image_urls"):
        for raw in state["input_image_urls"]:
            resolved = _prepare_image_for_api(raw) or str(raw)
            prepared_inputs.append(resolved)

    upload_prepared = _prepare_image_for_api(state.get("upload_image_path"))
    if upload_prepared:
        prepared_inputs.insert(0, upload_prepared)

    reference_logo = state.get("reference_logo") or {}
    reference_image = _prepare_image_for_api(reference_logo.get("image_url"))
    if reference_image:
        prepared_inputs.insert(0, reference_image)

    prepared_inputs = _dedupe_preserve(prepared_inputs)

    style_ref_mode = bool(state.get("style_ref_mode"))
    remix_mode = (state.get("remix_mode") or "").lower()
    style_refs = state.get("style_reference_images") or []
    presented_style_refs: List[str] = []
    for raw in style_refs:
        resolved = _prepare_image_for_api(raw)
        if resolved:
            presented_style_refs.append(resolved)

    updates: LogoState = {}
    if prepared_inputs:
        updates["input_image_urls"] = prepared_inputs

    if presented_style_refs:
        updates["style_reference_urls"] = presented_style_refs

    reason = state.get("task_reason") or "heuristic"
    if task_enum == TaskType.GENERATE:
        if remix_mode == "remix":
            task_enum = TaskType.REMIX
            reason = "remix_mode"
        elif prepared_inputs:
            task_enum = TaskType.REMIX
            reason = "reference_present"
        elif style_ref_mode and presented_style_refs:
            task_enum = TaskType.REMIX
            reason = "style_reference_mode"
    if task_enum == TaskType.REMIX and not prepared_inputs:
        # Fallback to generate if remix has no base image
        task_enum = TaskType.GENERATE
        reason = "remix_without_image"

    updates["task_type"] = task_enum.value
    updates["task_reason"] = reason
    updates["updated_at"] = datetime.utcnow()
    return updates


def prompt_planner_node(state: LogoState) -> LogoState:
    """Synthesize a clear prompt that merges sidebar keywords + main prompt,
    conditioned by task type (generate/remix/edit) and feedback."""

    brand = state.get("brand_name") or ""
    desc = state.get("brand_description") or ""
    tone = state.get("brand_tone") or ""
    human_feedback = state.get("human_feedback") or ""
    eval_feedback = state.get("eval_feedback") or ""
    next_hint = state.get("next_prompt_hint") or ""
    keywords = state.get("prompt_keywords")
    user_prompt = state.get("user_prompt") or ""
    task = state.get("task_type") or TaskType.GENERATE.value

    brand_context = _brand_context(brand, desc, tone)
    kw_text = _keyword_string(keywords)
    base_prompt = _task_base_prompt(task, user_prompt, kw_text)

    merged_prompt = state.get("merged_prompt")
    if merged_prompt:
        base_prompt = merged_prompt
    elif not base_prompt:
        base_prompt = state.get("enhanced_prompt") or state.get("base_prompt") or ""

    planner_inputs = {
        "task": task,
        "instruction": _task_instruction_text(task),
        "brand_context": brand_context or "Not provided.",
        "base_prompt": base_prompt or "No request supplied.",
        "human_feedback": human_feedback or "None.",
        "eval_feedback": eval_feedback or "None yet.",
        "next_hint": next_hint or "None yet.",
    }

    with trace(
        "prompt_planner",
        run_type="chain",
        inputs={
            "task": task,
            "instruction": planner_inputs["instruction"],
            "base_prompt": planner_inputs["base_prompt"],
            "human_feedback": planner_inputs["human_feedback"],
        },
        metadata={"node": "prompt_planner"},
    ) as run:
        messages = _PLANNER_PROMPT.format_messages(**planner_inputs)
        llm = _get_planner_llm()
        enhanced = ""
        attempt_error: Optional[Exception] = None
        for attempt in range(_PLANNER_MAX_ATTEMPTS):
            try:
                completion = llm.invoke(messages, config=_PLANNER_CHAIN_CONFIG)
                candidate = _PLANNER_PARSER.invoke(completion).strip()
                enhanced = _guard_planner_output(candidate)
                break
            except Exception as exc:  # guardrail triggered
                attempt_error = exc
                continue
        if not enhanced:
            if attempt_error:
                run.add_metadata({"planner_error": str(attempt_error)})
                raise HTTPException(
                    status_code=500,
                    detail=f"Prompt planner failed guardrail: {attempt_error}",
                )
            enhanced = base_prompt
        updates: LogoState = {"enhanced_prompt": enhanced, "updated_at": datetime.utcnow()}
        run.add_outputs({"enhanced_prompt": enhanced})
        run.add_metadata(
            {
                "planner_attempts": attempt + 1,
                "base_prompt": base_prompt,
            }
        )
        return updates


def _first_url(urls: Optional[List[str] | List[HttpUrl]]) -> Optional[str]:
    if not urls:
        return None
    return str(urls[0])


def _load_bytes(source: str) -> bytes:
    if source.startswith("http://") or source.startswith("https://"):
        return requests.get(source, timeout=90).content
    if source.startswith("data:"):
        header, _, payload = source.partition(",")
        if ";base64" in header:
            if isinstance(payload, str):
                payload_bytes = payload.encode("utf-8")
            else:
                payload_bytes = payload
            return base64.b64decode(payload_bytes)
        return payload.encode("utf-8")
    from pathlib import Path

    return Path(source).read_bytes()


def _sanitize_mask_bytes(
    mask_bytes: bytes, target_size: Optional[Tuple[int, int]] = None
) -> bytes:
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
    logo_type = state.get("logo_type")
    style_preferences = state.get("style_preferences") or []
    reference_logo = state.get("reference_logo") or {}
    reference_image = reference_logo.get("image_url")
    reference_styles = reference_logo.get("style_tags") or []
    negative = state.get("negative_prompt")
    aspect_ratio = state.get("aspect_ratio")
    style_preset = state.get("style_preset")
    style_type = state.get("style_type")
    rendering_speed = state.get("rendering_speed") or "DEFAULT"
    seed = state.get("seed")
    input_images = state.get("input_image_urls")
    input_mask = state.get("input_mask_url")
    style_reference_prompt = state.get("style_reference_prompt") or ""
    style_reference_urls = state.get("style_reference_urls") or []
    if style_reference_urls and not style_reference_prompt:
        style_reference_prompt = "Mirror palette, brushwork, and finish from supplied style references."

    trace_inputs = {
        "task": task,
        "user_prompt": state.get("user_prompt"),
        "reference_image": reference_image,
        "mask_url": input_mask,
    }
    with trace(
        "image_operator",
        run_type="tool",
        inputs=trace_inputs,
        metadata={"node": "image_operator"},
    ) as run:
        combined_styles: List[str] = []
        for seq in (style_preferences, state.get("style_tags") or [], reference_styles):
            for tag in seq:
                if tag and tag not in combined_styles:
                    combined_styles.append(tag)

        prompt_bits: List[str] = [prompt.strip()] if prompt else []
        if logo_type:
            prompt_bits.append(f"Logo type emphasis: {logo_type}")
        if combined_styles:
            prompt_bits.append("Style cues: " + ", ".join(combined_styles))
        if style_reference_prompt:
            prompt_bits.append(f"Style inspiration: {style_reference_prompt}")
        prompt = " | ".join(bit for bit in prompt_bits if bit)

        if reference_image and task == TaskType.GENERATE.value:
            task = TaskType.REMIX.value
            input_images = [reference_image]
        elif reference_image and not input_images:
            input_images = [reference_image]

        api_ep = None
        if task == TaskType.GENERATE.value:
            if not style_type:
                style_type = "DESIGN"
            body = _generate_tool.invoke(
                {
                    "prompt": prompt,
                    "rendering_speed": rendering_speed,
                    "negative_prompt": negative,
                    "aspect_ratio": aspect_ratio,
                    "style_type": style_type,
                    "style_preset": None if style_type else style_preset,
                    "seed": seed,
                }
            )
            api_ep = "generate"
        elif task == TaskType.REMIX.value:
            base_img = _first_url(input_images)
            if not base_img:
                raise ValueError("remix requires at least one input_image_urls")
            body = _remix_tool.invoke(
                {
                    "prompt": prompt,
                    "rendering_speed": rendering_speed,
                    "negative_prompt": negative,
                    "aspect_ratio": aspect_ratio,
                    "style_type": style_type,
                    "style_preset": None if style_type else style_preset,
                    "seed": seed,
                    "strength": state.get("remix_strength"),
                    "num_images": state.get("remix_num_images"),
                    "image_bytes": _load_bytes(base_img),
                }
            )
            api_ep = "remix"
        elif task == TaskType.EDIT.value:
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
            body = _edit_tool.invoke(
                {
                    "prompt": prompt,
                    "rendering_speed": rendering_speed,
                    "negative_prompt": negative,
                    "aspect_ratio": aspect_ratio,
                    "style_type": style_type,
                    "style_preset": None if style_type else style_preset,
                    "seed": seed,
                    "keep_background": state.get("edit_keep_background"),
                    "edit_inpaint_strength": state.get("edit_inpaint_strength"),
                    "image_bytes": base_bytes,
                    "mask_bytes": sanitized_mask,
                }
            )
            api_ep = "edit"
        elif task == TaskType.REPLACE_BG.value:
            base_img = _first_url(input_images)
            if not base_img:
                raise ValueError("replace_bg requires input_image_urls[0]")
            base_bytes = _load_bytes(base_img)
            body = _replace_bg_tool.invoke(
                {
                    "prompt": prompt,
                    "rendering_speed": rendering_speed,
                    "style_type": style_type,
                    "style_preset": None if style_type else style_preset,
                    "seed": seed,
                    "image_bytes": base_bytes,
                    "magic_prompt": "ON",
                }
            )
            api_ep = "replace_bg"
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
            candidates.append(
                {"url": url, "source": "ideogram", "variant_id": item.get("id")}
            )

        operator_out = ImageOperatorOut(
            candidate_images=candidates,
            last_generated_image_url=last_url,
            is_image_safe=body.get("is_image_safe", True),
        )
        updates: LogoState = operator_out.model_dump(exclude_none=True)
        updates["api_endpoint"] = api_ep
        updates["updated_at"] = datetime.utcnow()
        run.add_outputs(
            {
                "task": task,
                "last_generated_image_url": last_url,
                "candidate_count": len(candidates),
            }
        )
        run.add_metadata({"prompt": prompt, "task_reason": state.get("task_reason")})
        return updates


def evaluator_node(state: LogoState) -> LogoState:
    """Use GPT-4o-mini vision to score alignment and propose a next prompt hint."""

    image_url = state.get("last_generated_image_url") or ""
    brand_desc = state.get("brand_description") or ""
    brand_tone = state.get("brand_tone") or ""
    human_feedback = state.get("human_feedback") or ""
    enhanced_prompt = state.get("enhanced_prompt") or ""
    user_intent = state.get("user_prompt") or enhanced_prompt or ""
    negative_prompt = state.get("negative_prompt") or "None."
    aspect_ratio = state.get("aspect_ratio")
    style_type = state.get("style_type") or state.get("style_preset")
    keywords = _keyword_string(state.get("prompt_keywords"))
    safety_notes = (
        state.get("safety_notes") or "Maintain trademark-safe, non-offensive symbols."
    )
    previous_eval_feedback = state.get("eval_feedback") or ""
    next_hint = state.get("next_prompt_hint") or ""

    if not image_url:
        return {
            "eval_score": None,
            "eval_feedback": "No image available for evaluation.",
            "next_prompt_hint": enhanced_prompt,
            "done": True,
            "updated_at": datetime.utcnow(),
        }

    layout_bits: List[str] = []
    if aspect_ratio:
        layout_bits.append(f"Aspect ratio target: {aspect_ratio}")
    if style_type:
        layout_bits.append(f"Style: {style_type}")
    if state.get("task_type"):
        layout_bits.append(f"Task type: {state.get('task_type')}")
    layout_text = " | ".join(layout_bits) if layout_bits else "Not specified."

    feedback_parts: List[str] = []
    if human_feedback:
        feedback_parts.append(f"User: {human_feedback}")
    if previous_eval_feedback:
        feedback_parts.append(f"Prev eval: {previous_eval_feedback}")
    if next_hint:
        feedback_parts.append(f"Next hint: {next_hint}")
    feedback_summary = " | ".join(feedback_parts) if feedback_parts else "None."

    messages = _EVALUATOR_PROMPT.format_messages(
        brand_description=brand_desc or "Not provided.",
        brand_tone=brand_tone or "Neutral.",
        user_intent=user_intent or "Not provided.",
        keywords=keywords or "None.",
        negative_prompt=negative_prompt,
        layout=layout_text,
        safety_notes=safety_notes,
        feedback_summary=feedback_summary,
    )
    messages = _attach_image_to_messages(messages, image_url)

    llm = _get_evaluator_llm()
    structured_llm = llm.with_structured_output(EvaluatorScores)
    score_int = _EVAL_DEFAULT_SCORE
    feedback = "No feedback returned."
    hint = "Refine typography and contrast."
    score_map: Dict[str, int] = {}
    last_error: Optional[Exception] = None
    for attempt in range(_EVALUATOR_MAX_ATTEMPTS):
        try:
            response = structured_llm.invoke(messages, config=_EVALUATOR_CHAIN_CONFIG)
            score_map = {
                "score_match": response.score_match,
                "score_typo": response.score_typo,
                "score_hangul": response.score_hangul,
                "score_negative": response.score_negative,
                "score_layout": response.score_layout,
                "score_feedback": response.score_feedback,
                "score_overall": response.score_overall,
            }
            score_int = response.score_overall
            feedback = response.feedback.strip() or feedback
            hint = response.hint.strip() or hint
            break
        except Exception as exc:
            last_error = exc
            score_map = {}
            continue
    if not score_map:
        if last_error:
            raise HTTPException(
                status_code=500, detail=f"Evaluator failed guardrail: {last_error}"
            )
        score_map = {k: _EVAL_DEFAULT_SCORE for k in _EVAL_KEY_MAP}
        score_int = _EVAL_DEFAULT_SCORE

    if human_feedback:
        hint = f"{hint}\nRespect user note: {human_feedback}"

    score_norm = round(score_int / 100.0, 3)
    regen_reasons: List[str] = []
    for metric, threshold in _REGEN_THRESHOLDS.items():
        if score_map.get(metric, _EVAL_DEFAULT_SCORE) < threshold:
            regen_reasons.append(f"{metric.lower()}<{threshold}")
    if human_feedback:
        regen_reasons.append("human_feedback_present")
    need_regen = bool(regen_reasons)
    regen_round = int(state.get("regen_round", 0))

    updates: LogoState = {
        "eval_score": float(score_norm),
        "eval_feedback": feedback,
        "next_prompt_hint": hint,
        "updated_at": datetime.utcnow(),
    }
    for metric_key, state_key in _EVAL_KEY_MAP.items():
        if metric_key == "score_overall":
            continue
        updates[state_key] = score_map.get(metric_key, _EVAL_DEFAULT_SCORE)

    if need_regen and regen_round < 3:
        updates["regen_round"] = regen_round + 1
        updates["enhanced_prompt"] = hint
        history = list(state.get("regen_history") or [])
        history.append(
            {
                "round": str(regen_round + 1),
                "reason": ", ".join(regen_reasons),
                "score": str(score_int),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )
        updates["regen_history"] = history[-5:]
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
