# 로고 없이 숏폼 프롬프트/아이디어 생성 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 초기 작성
# - 2025-11-25: brand_profile / 마지막 유저 발화 컨텍스트 사용
# - 2025-11-25: 생성된 프롬프트를 shorts_state.generated_prompt 에 저장

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import json

from langgraph.graph import END
from langgraph.types import Command
from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.shorts.prompts import PROMPT_GENERATION_SYSTEM_PROMPT
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState, ShortsState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def make_generate_prompt_no_logo_node(llm: "BaseChatModel"):
    """
    로고를 사용하지 않는 경우의 숏폼 아이디어/프롬프트 생성 노드 팩토리.

    - check_logo_node 에서 logo_usage_choice == "without_logo" 일 때 호출됨
    - 기존 로고는 전혀 고려하지 않고, 브랜드 정보 + 사용자 요청만으로 숏폼 프롬프트를 생성한다.
    """

    def generate_prompt_no_logo_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        로고 없이 진행하는 숏폼 아이디어/프롬프트를 한 번 생성한다.
        """
        # 1) 컨텍스트 로드
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

        # 마지막 사용자 발화
        last_user_text = get_last_user_message(state)

        # 브랜드 프로필을 JSON 문자열로 변환 (프롬프트에 그대로 보여주기 위함)
        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)

        # 2) HumanMessage 내용 구성
        user_prompt = (
            "You are given the following brand profile and the latest user request.\n\n"
            "[BRAND PROFILE]\n"
            f"{brand_profile_json}\n\n"
            "[LATEST USER REQUEST]\n"
            f"{last_user_text}\n\n"
            "Using the system instructions, create a single Veo 3.1 video prompt "
            "following the 7-section format."
        )

        messages = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        # 3) LLM 호출
        ai_msg = llm.invoke(messages)

        # 4) 생성된 프롬프트를 shorts_state 에도 저장
        shorts_state["generated_prompt"] = getattr(ai_msg, "content", "")

        return Command(
            update={
                "messages": [ai_msg],
                "shorts_state": shorts_state,
            },
            goto=END,
        )

    return generate_prompt_no_logo_node