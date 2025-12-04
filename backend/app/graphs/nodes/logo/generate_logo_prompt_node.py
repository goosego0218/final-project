# 로고 프롬프트 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성
# - 2025-12-04: 레퍼런스 이미지 처리 추가

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import json

from langgraph.types import Command
from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.logo.prompts import LOGO_GENERATION_SYSTEM_PROMPT, LOGO_REFERENCE_SYSTEM_PROMPT
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState, LogoState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def make_generate_logo_prompt_node(llm_prompt: "BaseChatModel"):
    """
    브랜드 정보로 로고 프롬프트 생성 노드 팩토리 
    """
    
    def generate_logo_prompt_node(state: "AppState") -> Command[Literal["generate_logo"]]:
        """
        브랜드 프로필 + 사용자 요청 → Gemini 프롬프트 생성
        (참조 이미지 유무에 따라 로직 분기기)
        """
        # 1) 컨텍스트 로드
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        logo_state: "LogoState" = dict(state.get("logo_state") or {})
        last_user_text = get_last_user_message(state)
        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)

#----------------------------------------25-12-04 레퍼런스 이미지 처리--------------------------------
        # 레퍼런스 이미지 확인
        reference_images = logo_state.get("reference_images") or []
        has_reference = len(reference_images) > 0

        # 시스템 프롬프트 선택
        if has_reference:
            system_prompt_text = LOGO_REFERENCE_SYSTEM_PROMPT
            instruction = "Using the system instructions and ATTACHED IMAGES, create a prompt."
        else:
            system_prompt_text = LOGO_GENERATION_SYSTEM_PROMPT
            instruction = "Using the system instructions, create a prompt."

        user_prompt = (
            f"You are given the following brand profile and the latest user request.\n\n"
            f"[BRAND PROFILE]\n{brand_profile_json}\n\n"
            f"[LATEST USER REQUEST]\n{last_user_text}\n\n"
            f"{instruction}\n\n"
            "Output ONLY the final prompt text."
            # "Using the system instructions, create a single Gemini image generation prompt "
            # "for a professional brand logo.\n\n"
            # "**IMPORTANT: The prompt must specify that only ONE single logo design should be generated. "
            # "Do not create multiple logo variations, versions, or alternatives in one image.**"
        )
#------------------------------------------------------------------------
        messages = [
            SystemMessage(content=system_prompt_text),
            HumanMessage(content=user_prompt),
        ]

        # 3) LLM 호출
        ai_msg = llm_prompt.invoke(messages)
        generated_content = getattr(ai_msg, "content", "")
        # [2025-12-04 핵심 로직] LLM이 리셋 플래그를 보냈는지 확인
        # LOGO_REFERENCE_SYSTEM_PROMPT에서 "[RESET_REFERENCE]"를 뱉도록 유도했음
        if "[RESET_REFERENCE]" in generated_content:
            print("🔄 LLM 감지: 레퍼런스 이미지 삭제 요청")
            # 플래그 제거 후 텍스트만 남김
            generated_content = generated_content.replace("[RESET_REFERENCE]", "").strip()
            # State에서 레퍼런스 이미지 비움
            logo_state["reference_images"] = []
            
            # 만약 내용이 비었다면 기본 프롬프트로 재생성 (선택사항, 여기선 그냥 진행)
        
        # 결과 저장
        logo_state["generated_prompt"] = generated_content
        
        return Command(
            update={
                "messages": [ai_msg],
                "logo_state": logo_state, # 여기서 갱신된(비워진) 이미지 리스트가 넘어감
            },
            goto="generate_logo",
        )
    
    return generate_logo_prompt_node