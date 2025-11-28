# 로고 프롬프트 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import json

from langgraph.types import Command
from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.logo.prompts import LOGO_GENERATION_SYSTEM_PROMPT
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState, LogoState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def make_generate_logo_prompt_node(llm: "BaseChatModel"):
    """
    브랜드 정보로 로고 프롬프트 생성 노드 팩토리 
    """
    
    def generate_logo_prompt_node(state: "AppState") -> Command[Literal["generate_logo"]]:
        """
        브랜드 프로필 + 사용자 요청 → Gemini 프롬프트 생성
        """
        # 1) 컨텍스트 로드
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        logo_state: "LogoState" = dict(state.get("logo_state") or {})
        
        # 마지막 사용자 발화
        last_user_text = get_last_user_message(state)
        
        # 브랜드 프로필을 JSON 문자열로 변환
        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)
        
        # 2) HumanMessage 내용 구성
        user_prompt = (
            "You are given the following brand profile and the latest user request.\n\n"
            "[BRAND PROFILE]\n"
            f"{brand_profile_json}\n\n"
            "[LATEST USER REQUEST]\n"
            f"{last_user_text}\n\n"
            "Using the system instructions, create a single Gemini image generation prompt "
            "for a professional brand logo.\n\n"
            "**IMPORTANT: The prompt must specify that only ONE single logo design should be generated. "
            "Do not create multiple logo variations, versions, or alternatives in one image.**"
        )
        
        messages = [
            SystemMessage(content=LOGO_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]
        
        # 3) LLM 호출
        ai_msg = llm.invoke(messages)
        
        # 4) 생성된 프롬프트를 logo_state에 저장
        logo_state["generated_prompt"] = getattr(ai_msg, "content", "")
        
        return Command(
            update={
                "messages": [ai_msg],
                "logo_state": logo_state,
            },
            goto="generate_logo",
        )
    
    return generate_logo_prompt_node