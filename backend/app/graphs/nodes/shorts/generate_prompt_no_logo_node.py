# 로고 없이 숏폼 프롬프트/아이디어 생성 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING
from langgraph.graph import END

from langchain_core.messages import SystemMessage
from langgraph.types import Command
from app.graphs.nodes.shorts.prompts import PROMPT_GENERATION_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState, ShortsState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def make_generate_prompt_no_logo_node(llm: "BaseChatModel"):
    """
    로고를 사용하지 않는 경우의 숏폼 아이디어/프롬프트 생성 노드 팩토리.

    - check_logo_node 에서 logo_usage_choice == "without_logo" 일 때 호출됨
    - 기존 로고는 전혀 고려하지 않고, 브랜드 정보만으로 숏폼 기획/스크립트를 생성
    """

    def generate_prompt_no_logo_node(state: "AppState") -> Command:
        """
        로고 없이 진행하는 숏폼 아이디어/프롬프트를 한 번 생성한다.
        """
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

        messages = [SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT)] + list(state.get("messages", []))
        ai_msg = llm.invoke(messages)

        return Command(
            update={
                "messages": [ai_msg],
                "shorts_state": shorts_state,
            },
            goto=END
        )

    return generate_prompt_no_logo_node