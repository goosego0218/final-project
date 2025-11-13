from __future__ import annotations

import json
from typing import Optional, Tuple

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from .config import OPENAI_API_KEY


_TASK_MODE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You classify logo design requests into exactly one of four modes: "
                "generate, remix, edit, replace_bg."
                " Respond ONLY with a compact JSON object like "
                "{{\"mode\": \"remix\", \"reason\": \"short justification\"}}."
                " generate → new logo from scratch."
                " remix → variation of an existing reference image."
                " edit → localized edits or masking instructions."
                " replace_bg → remove or change background."
                " Never add extra text outside the JSON response."
            ),
        ),
        (
            "user",
            "Prompt: 새 브랜드 로고를 새롭게 디자인해 줘\n"
            "Reference image provided: no\n"
            "Mask provided: no\n"
            "Recent image reuse: no",
        ),
        ("assistant", '{{"mode":"generate","reason":"User requests a new logo from scratch"}}'),
        (
            "user",
            "Prompt: 기존 레퍼런스 느낌 유지하면서 다른 버전을 만들어 줘\n"
            "Reference image provided: yes\n"
            "Mask provided: no\n"
            "Recent image reuse: yes",
        ),
        ("assistant", '{{"mode":"remix","reason":"Reference image supplied and user wants variants"}}'),
        (
            "user",
            "Prompt: 글자 부분만 붉은색으로 바꿔 줘\n"
            "Reference image provided: yes\n"
            "Mask provided: yes\n"
            "Recent image reuse: yes",
        ),
        ("assistant", '{{"mode":"edit","reason":"User describes localized edits with masking"}}'),
        (
            "user",
            "Prompt: 배경을 투명하게 없애 줘\n"
            "Reference image provided: yes\n"
            "Mask provided: no\n"
            "Recent image reuse: no",
        ),
        ("assistant", '{{"mode":"replace_bg","reason":"Background removal explicitly requested"}}'),
        (
            "user",
            "Prompt: {prompt}\n"
            "Reference image provided: {has_reference}\n"
            "Mask provided: {has_mask}\n"
            "Recent image reuse: {recent_reuse}",
        ),
    ]
)


def _get_classifier_llm() -> Optional[ChatOpenAI]:
    if not OPENAI_API_KEY:
        return None
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        streaming=False,
        api_key=OPENAI_API_KEY,
        max_retries=2,
    )


def classify_task_mode(
    prompt: str,
    has_reference: bool,
    has_mask: bool,
    has_recent_reuse: bool,
) -> Tuple[str, str]:
    """Return (mode, reason). Defaults to generate if the LLM fails."""

    if has_mask:
        return "edit", "Mask detected from user context"

    prompt_text = (prompt or "").strip() or "(no explicit prompt provided)"

    messages = _TASK_MODE_PROMPT.format_messages(
        prompt=prompt_text,
        has_reference="yes" if has_reference else "no",
        has_mask="yes" if has_mask else "no",
        recent_reuse="yes" if has_recent_reuse else "no",
    )
    llm = _get_classifier_llm()
    if llm is None:
        prompt_lower = prompt_text.lower()
        if "background" in prompt_lower or "배경" in prompt_text:
            return "replace_bg", "LLM unavailable; keyword implies background change"
        if has_reference or has_recent_reuse:
            return "remix", "LLM unavailable; reference or reuse detected"
        return "generate", "LLM unavailable; defaulting to generate"
    try:
        response = llm.invoke(messages)
        raw = response.content if isinstance(response.content, str) else ""
        parsed = json.loads(raw)
        mode = str(parsed.get("mode", "generate")).strip().lower()
        reason = str(parsed.get("reason", "LLM classification")).strip()
    except Exception:
        mode = "generate"
        reason = "LLM fallback classification"

    if mode not in {"generate", "remix", "edit", "replace_bg"}:
        mode = "generate"
    return mode, reason or "LLM classification"
