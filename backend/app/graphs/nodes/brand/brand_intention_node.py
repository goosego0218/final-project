# 브랜드 의도 분류 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, Any, Literal

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import Command

from app.graphs.nodes.common.message_utils import get_last_user_message
from app.graphs.nodes.brand.prompt.brand_intention_node_prompts import _INTENTION_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_brand_intention_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_intention 노드를 만들어 주는 팩토리.

    brand_agent 에서:

        llm = get_chat_model()
        brand_intention = make_brand_intention_node(llm)

    이런 식으로 사용할 예정.
    """

    def brand_intention(state: "AppState",) -> Command[Literal["brand_chat", "trend_search", "trend_refine", "brand_collect", "persist_brand",]]:
        """
        마지막 사용자 발화를 보고 의도를 분류해
        state.meta["intent"] 에 저장하고,
        다음에 실행할 노드를 Command.goto 로 결정하는 노드.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            # 유저 발화가 없으면 의도 분류할 수 없으니
            # 상태 변경 없이 brand_chat 으로 넘긴다.
            return Command(update={}, goto="brand_chat")

        # 참고용 컨텍스트 (필수는 아님)
        brand_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})
        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})

        profile_snippet = json.dumps(brand_profile, ensure_ascii=False)[:400]
        last_trend_summary = (trend_context.get("last_result_summary") or "")[:400]

        system_prompt = _INTENTION_SYSTEM_PROMPT + f"""

[참고 정보]

- 현재까지 정리된 브랜드 프로필 (일부):
{profile_snippet}

- 직전 트렌드 요약 (있다면):
{last_trend_summary}
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text),
        ]

        ai_msg = llm.invoke(messages)
        raw = (ai_msg.content or "").strip()

        # 기본값은 brand_info 로 둔다 (예전 동작과 최대한 비슷하게)
        label = "brand_info"
        reason = ""

        # JSON 파싱 시도
        try:
            parsed = json.loads(raw)
            intent_val = parsed.get("intent")
            if isinstance(intent_val, str):
                intent_val = intent_val.strip()
            allowed = (
                "smalltalk",
                "brand_info",
                "edit_brand", 
                "trend_new",
                "trend_retry",
                "trend_refine",
                "finalize",
            )

            if intent_val in allowed:
                label = intent_val
            reason_val = parsed.get("reason")
            if isinstance(reason_val, str):
                reason = reason_val.strip()
        except json.JSONDecodeError:
            # JSON 파싱 실패 시, 텍스트 안에서 label만 대충 뽑아보기
            lowered = raw.lower()
            if "smalltalk" in lowered:
                label = "smalltalk"
            elif "edit_brand" in lowered:
                label = "edit_brand"                
            elif "trend_retry" in lowered:
                label = "trend_retry"
            elif "trend_refine" in lowered:
                label = "trend_refine"
            elif "trend_new" in lowered:
                label = "trend_new"
            elif "finalize" in lowered:
                label = "finalize"
            else:
                label = "brand_info"

        new_meta: Dict[str, Any] = dict(state.get("meta") or {})
        new_meta["intent"] = {
            "label": label,
            "reason": reason,
            "raw": raw,
        }

        # --- 필수 필드 검증 (브랜드 이름, 업종) ---
        brand_profile_for_validation: Dict[str, Any] = dict(
            state.get("brand_profile") or {}
        )
        # BrandProfile 스키마 기준: brand_name, category
        brand_name = (brand_profile_for_validation.get("brand_name") or "").strip()
        category = (brand_profile_for_validation.get("category") or "").strip()

        required_missing = []
        if not brand_name:
            required_missing.append("brand_name")
        if not category:
            required_missing.append("category")

        validation = {
            # 예: ["brand_name"], ["category"], ["brand_name", "category"]
            "required_missing": required_missing,
            # 둘 다 채워져 있으면 True
            "is_valid": not required_missing,
        }

        new_meta["validation"] = validation

        is_valid = bool(validation.get("is_valid"))

        # 여기가 핵심: intent 에 따라 다음 노드 결정
        goto: Literal["brand_chat", "trend_search", "trend_refine", "brand_collect", "persist_brand",]

        if label in ("trend_new", "trend_retry"):
            goto = "trend_search"

        elif label == "trend_refine":
            goto = "trend_refine"

        elif label == "brand_info":
            goto = "brand_collect"

        elif label == "edit_brand":
            has_any_profile = bool(brand_profile_for_validation)
            if not has_any_profile:
                goto = "brand_chat"
            else:
                goto = "brand_collect"

        elif label == "finalize":
            if is_valid:
                goto = "persist_brand"
            else:
                goto = "brand_collect"

        else:
            # smalltalk / brand_info / 기타
            goto = "brand_chat"

        return Command(
            update={"meta": new_meta},
            goto=goto,
        )

    return brand_intention