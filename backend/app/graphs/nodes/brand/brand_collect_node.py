# 브랜드 정보 수집 노드 (1단계)
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

import json
from typing import Dict, Any, TYPE_CHECKING, Literal

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import Command

from app.graphs.nodes.common.message_utils import get_last_user_message
from app.graphs.nodes.brand.prompt.brand_collect_node_prompts import _BRAND_COLLECT_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def _merge_brand_profile(
    current: Dict[str, Any],
    updates: Dict[str, Any],
) -> Dict[str, Any]:
    """
    기존 brand_profile 위에 업데이트를 얹는 머지 함수.

    - updates에 없는 키는 그대로 둔다.
    - updates에 있는 키 중에서
      - None, 빈 문자열/공백 문자열은 무시
      - 그 외 값은 그대로 덮어씀
    """
    out = dict(current or {})

    for key, value in updates.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        out[key] = value

    return out


def make_brand_collect_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_collect 노드를 만들어 주는 팩토리.

    brand_agent에서:

        llm = get_chat_model()
        brand_collect = make_brand_collect_node(llm)

    이런 식으로 사용.
    """
    def brand_collect(state: "AppState") -> Command[Literal["brand_chat"]]:
        """
        마지막 사용자 발화에서 브랜드 정보를 추출해
        state.brand_profile 에 누적/병합하는 노드.
        """

        user_text = get_last_user_message(state)
        if not user_text:
            return Command(update={}, goto="brand_chat")

        current_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})
        current_profile_json = json.dumps(current_profile, ensure_ascii=False)

        system_prompt = _BRAND_COLLECT_SYSTEM_PROMPT + f"""

[현재까지 알고 있는 브랜드 프로필]

{current_profile_json}

이제 아래 사용자의 최신 발화를 보고,
새로 채워지거나 수정된 필드만 brand_profile_updates로 추출해.
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text),
        ]

        ai_msg = llm.invoke(messages)
        raw = (ai_msg.content or "").strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            new_meta = dict(state.get("meta") or {})
            new_meta.setdefault("brand_collect", {})
            new_meta["brand_collect"]["last_raw"] = raw

            return Command(
                update={"meta": new_meta},
                goto="brand_intention",
            )

        updates = parsed.get("brand_profile_updates") or {}
        if not isinstance(updates, dict) or not updates:
            # 업데이트가 없으면 아무 변화 없음
            return Command(update={}, goto="brand_chat")

        merged_profile = _merge_brand_profile(current_profile, updates)

        new_meta = dict(state.get("meta") or {})
        new_meta.setdefault("brand_collect", {})
        new_meta["brand_collect"]["last_updates"] = updates

        return Command(
            update={
                "brand_profile": merged_profile,
                "meta": new_meta,
            },
            goto="brand_chat",
        )

    return brand_collect

