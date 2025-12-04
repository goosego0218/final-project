# 이미지 기반 숏폼 프롬프트 생성 노드
# 작성일: 2025-12-04
# 수정내역
# - 2025-12-04: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Literal, Dict, Any
import json

from langgraph.graph import END
from langgraph.types import Command
from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.shorts.prompt.prompts import PROMPT_GENERATION_SYSTEM_PROMPT
from app.agents.state import AppState

if TYPE_CHECKING:
    from langchain_core.language_models.chat_models import BaseChatModel


def make_generate_prompt_with_image_node(llm: "BaseChatModel"):
    """
    이미지를 참고하여 숏폼 프롬프트를 생성하는 노드 팩토리.
    이미지 설명과 브랜드 프로필을 결합하여 프롬프트 생성.
    """
    
    def generate_prompt_with_image_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        이미지 설명 + 브랜드 프로필 + 사용자 요구사항을 기반으로
        16초(Part 1 + Part 2) 프롬프트를 생성한다.
        """
        brand_profile: Dict[str, Any] = state.get("brand_profile") or {}
        shorts_state: Dict[str, Any] = dict(state.get("shorts_state") or {})
        
        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)
        
        # 이미지 설명
        # image_description = shorts_state.get("image_description", "")
        
        # 사용자 요구사항
        user_requirements = shorts_state.get("user_requirements") or {}
        user_requirements_json = json.dumps(
            user_requirements, ensure_ascii=False, indent=2
        )
        
        # visual_style 오버라이드
        visual_style = user_requirements.get("visual_style")
        if isinstance(visual_style, str):
            visual_style = visual_style.strip()
        else:
            visual_style = ""
        
        if visual_style:
            visual_style_block = (
                "\n[VISUAL STYLE OVERRIDE]\n"
                "Ignore the default photo-realistic live-action description in section [2. VISUAL STYLE].\n"
                "Instead, you MUST strictly follow this visual style description when describing shots:\n"
                f"{visual_style}\n"
            )
        else:
            visual_style_block = (
                "\n[VISUAL STYLE OVERRIDE]\n"
                "If the user did not request a specific visual style,\n"
                "you MUST keep using the default photo-realistic live-action cinematic commercial look\n"
                "described in section [2. VISUAL STYLE].\n"
            )
        
        # Part 1 프롬프트 생성
        user_prompt_part1 = (
            f"Create the prompt for **PART 1 (기-승: Setup & Build-up, 0-8s)** of a 16-second story.\n\n"
            f"[BRAND PROFILE]\n{brand_profile_json}\n\n"
            f"[USER REQUIREMENTS]\n{user_requirements_json}\n\n"
            f"{visual_style_block}\n"
            f"INSTRUCTIONS:\n"
            f"- The reference image provides visual guidance for the video style, composition, and mood.\n"
            f"- When there is any conflict between BRAND PROFILE and USER REQUIREMENTS,\n"
            f"  you MUST follow USER REQUIREMENTS first.\n"
            f"- When there is any conflict between REFERENCE IMAGE and other sources,\n"
            f"  prioritize REFERENCE IMAGE for visual style, but follow USER REQUIREMENTS for content.\n"
            f"- Focus on establishing the scene and building anticipation.\n"
            f"- Choose a specific everyday situation that feels natural and relatable.\n"
            f"- **DO NOT** show the logo at the end.\n"
            f"- End with an action IN PROGRESS.\n"
            f"- Only Korean dialogue in [5.] should be in Korean."
        )
        
        messages_1 = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt_part1),
        ]
        ai_msg_1 = llm.invoke(messages_1)
        prompt_part1 = getattr(ai_msg_1, "content", "")
        
        # Part 1 요약
        summary_system = SystemMessage(
            content=(
                "You are a helpful assistant that summarizes Veo 3.1 video prompts.\n"
                "Given a full PART 1 prompt, summarize it in 3–4 concise sentences.\n"
                "Focus on: 1) visual setup, 2) main actions, 3) emotional tone, and 4) cliffhanger ending.\n"
                "Do NOT include section headers or markdown. Output plain English sentences only."
            )
        )
        summary_human = HumanMessage(
            content=f"Here is the full PART 1 prompt:\n\n{prompt_part1}\n\nSummarize it now."
        )
        
        summary_msg = llm.invoke([summary_system, summary_human])
        part1_summary = getattr(summary_msg, "content", "").strip()
        
        if not part1_summary:
            part1_summary = prompt_part1[:800]
        
        # Part 2 프롬프트 생성
        user_prompt_part2 = (
            f"Now create the prompt for **PART 2 (전-결: Climax & Resolution, 8-16s)**.\n\n"
            f"It must continue DIRECTLY from Part 1. Here is a brief summary of PART 1:\n"
            f"---\n{part1_summary}\n---\n\n"
            f"[USER REQUIREMENTS]\n{user_requirements_json}\n\n"
            f"{visual_style_block}\n"
            f"INSTRUCTIONS:\n"
            f"- When there is any conflict between BRAND PROFILE and USER REQUIREMENTS,\n"
            f"  you MUST follow USER REQUIREMENTS first.\n"
            f"- VISUAL MATCH: Start exactly where Part 1 ended (same lighting, angle, character position).\n"
            f"- In PART 2, the main character must keep the **same face, hairstyle, outfit, and body type** as in PART 1.\n"
            f"- Show the action completing.\n"
            f"- Show emotional satisfaction or relief in a way that fits this brand's tone.\n"
            f"- End with a strong, satisfying emotional or product shot inside the same scene, not a separate logo-only end card.\n"
            f"- Do NOT cut to a standalone logo screen; keep the last frame within the cinematic live-action or product shot.\n"
            f"- Only Korean dialogue in [5.] should be in Korean.\n"
        )
        
        messages_2 = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt_part2),
        ]
        ai_msg_2 = llm.invoke(messages_2)
        prompt_part2 = getattr(ai_msg_2, "content", "")
        
        # 프롬프트 저장
        shorts_state["generated_prompt"] = prompt_part1
        shorts_state["generated_prompts"] = [prompt_part1, prompt_part2]
        
        return Command(
            update={
                "messages": [ai_msg_1, ai_msg_2],
                "shorts_state": shorts_state,
            },
            goto=END,
        )
    
    return generate_prompt_with_image_node

