# 로고 없이 숏폼 프롬프트/아이디어 생성 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 초기 작성
# - 2025-11-25: brand_profile / 마지막 유저 발화 컨텍스트 사용
# - 2025-11-25: 생성된 프롬프트를 shorts_state.generated_prompt 에 저장
# - 2025-12-02: 16초(8초+8초) 영상을 기본으로 생성하게 변경쓰

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import json

from langgraph.graph import END
from langgraph.types import Command
from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.shorts.prompt.prompts import PROMPT_GENERATION_SYSTEM_PROMPT
from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState, ShortsState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel

def make_generate_prompt_no_logo_node(llm: "BaseChatModel"):
    """
    로고를 사용하지 않는 경우의 숏폼 아이디어/프롬프트 생성 노드 팩토리.
    16초(Part 1 + Part 2) 연속 스토리 프롬프트를 생성한다.
    """

    def generate_prompt_no_logo_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        16초 영상을 위해 Part 1(기-승)과 Part 2(전-결) 두 개의 프롬프트를 생성한다.
        """
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)
        
        user_requirements = shorts_state.get("user_requirements") or {}
        user_requirements_json = json.dumps(
            user_requirements, ensure_ascii=False, indent=2
        )

        visual_style = user_requirements.get("visual_style")
        if isinstance(visual_style, str):
            visual_style = visual_style.strip()
        else:
            visual_style = ""

        # 스타일 오버라이드 블록
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

        # v2
        user_prompt_part1 = (
            f"Create the prompt for **PART 1 (기-승: Setup & Build-up, 0-8s)** of a 16-second story.\n\n"
            f"[BRAND PROFILE]\n{brand_profile_json}\n\n"
            f"[USER REQUIREMENTS]\n{user_requirements_json}\n\n"         
            f"{visual_style_block}\n"
            f"INSTRUCTIONS:\n"
            f"- When there is any conflict between BRAND PROFILE and USER REQUIREMENTS,\n"
            f"  you MUST follow USER REQUIREMENTS first.\n"
            f"- Focus on establishing the scene and building anticipation.\n"
            f"- Imagine this is ONE possible story among many for this brand.\n"
            f"- Choose a specific everyday situation for the target customer "
            f"that feels natural and relatable (e.g., busy workday break, weekend outing, late-night snack, etc.).\n"
            f"- **DO NOT** show the logo at the end.\n"
            f"- End with an action IN PROGRESS (e.g., hand reaching for food, about to take a bite).\n"
            f"- The viewer should want to see what happens next.\n"
            f"- Narration/dialogue in section [5] can be Korean, but ALL visual descriptions must avoid Korean text entirely (use English letters or non-text visuals, including the final logo/end card)."
        )

        messages_1 = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt_part1),
        ]
        ai_msg_1 = llm.invoke(messages_1)
        prompt_part1 = getattr(ai_msg_1, "content", "")
    
        # [NEW] Part 1 프롬프트 요약 생성
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

        # 요약이 비어 있으면 fallback으로 앞부분만 잘라서 사용
        if not part1_summary:
            part1_summary = prompt_part1[:800]

        # 기존 로직: Part 2가 Part 1과 자연스럽게 이어지도록
        # 요약뿐 아니라 FULL Part 1 프롬프트까지 함께 전달한다.
        part1_context = (
            "Here is the FULL PART 1 prompt that must be continued exactly:\n"
            "------------------------------------------------------------\n"
            f"{prompt_part1}\n"
            "------------------------------------------------------------"
        )

        # [Part 2] 전-결 (Climax & Resolution)
        user_prompt_part2 = (
            f"Now create the prompt for **PART 2 (전-결: Climax & Resolution, 8-16s)**.\n\n"
            "This prompt will be used with the Veo 3.1 **video extension** feature to EXTEND the previous 8-second clip.\n"
            "So you are NOT making a new video from scratch — you are continuing the exact same scene.\n\n"
            f"Use both the summary and full prompt below as the ONLY truth about what has already happened:\n"
            f"[PART 1 SUMMARY]\n{part1_summary}\n\n"
            f"{part1_context}\n\n"
            f"[USER REQUIREMENTS]\n{user_requirements_json}\n\n"
            f"{visual_style_block}\n"
            "INSTRUCTIONS:\n"
            "- In [4. SCENE COMPOSITION — 8 SECONDS], you are describing seconds 8–16 of the full 16-second story,\n"
            "  but you MUST still use the 0–8s time range convention because this is one 8-second Veo clip.\n"
            "- The VERY FIRST FRAME of PART 2 must visually match the LAST FRAME of PART 1:\n"
            "  same location, same time of day, same lighting, same camera angle, same character pose, same props.\n"
            "- Do NOT start with a new establishing shot, new place, or new characters.\n"
            "- Just continue and complete the action that was in progress at the end of PART 1, then resolve it.\n"
            "- When there is any conflict between BRAND PROFILE and USER REQUIREMENTS,\n"
            "  you MUST follow USER REQUIREMENTS first.\n"
            "- VISUAL MATCH: Start exactly where Part 1 ended (same lighting, angle, character position).\n"
            "- Show the action completing (e.g., taking the bite, drinking the coffee, sharing the food).\n"
            "- Show emotional satisfaction or relief in a way that fits this brand's tone.\n"
            "- MUST end with the brand logo and slogan narration.\n"
            "- This Part 2 should feel like a natural conclusion to Part 1, not a new episode.\n"
            "- Narration/dialogue in section [5] can be Korean, but ALL visual descriptions must avoid Korean text entirely "
            "(use English letters or non-text visuals, including the final logo/end card)."
        )

        messages_2 = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt_part2),
        ]
        ai_msg_2 = llm.invoke(messages_2)
        prompt_part2 = getattr(ai_msg_2, "content", "")

        # 4) 생성된 프롬프트를 shorts_state에 저장
        shorts_state["generated_prompt"] = prompt_part1  # 호환성 유지
        shorts_state["generated_prompts"] = [prompt_part1, prompt_part2]  # 16초용

        return Command(
            update={
                "messages": [ai_msg_1, ai_msg_2],
                "shorts_state": shorts_state,
            },
            goto=END,
        )

    return generate_prompt_no_logo_node