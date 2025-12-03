# 로고 없이 숏폼 프롬프트/아이디어 생성 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 초기 작성
# - 2025-11-25: brand_profile / 마지막 유저 발화 컨텍스트 사용
# - 2025-11-25: 생성된 프롬프트를 shorts_state.generated_prompt 에 저장
# - 2025-12-02: 16초(8초+8초) 영상을 기본으로 생성하게 변경쓰쓰

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
    16초(Part 1 + Part 2) 연속 스토리 프롬프트를 생성한다.
    """

    def generate_prompt_no_logo_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        16초 영상을 위해 Part 1(기-승)과 Part 2(전-결) 두 개의 프롬프트를 생성한다.
        """
        brand_profile: "BrandProfile" = state.get("brand_profile") or {}
        shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

        brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)


        # # [Part 1] 기-승 (Setup & Build-up) v1
        # user_prompt_part1 = (
        #     f"Create the prompt for **PART 1 (기-승: Setup & Build-up, 0-8s)** of a 16-second story.\n\n"
        #     f"[BRAND PROFILE]\n{brand_profile_json}\n\n"
        #     f"INSTRUCTIONS:\n"
        #     f"- Focus on establishing the scene and building anticipation.\n"
        #     f"- **DO NOT** show the logo at the end.\n"
        #     f"- End with an action IN PROGRESS (e.g., hand reaching for food, about to take a bite).\n"
        #     f"- The viewer should want to see what happens next.\n"
        #     f"- Only Korean dialogue in [5.] should be in Korean."
        # )
        # v2
        user_prompt_part1 = (
            f"Create the prompt for **PART 1 (기-승: Setup & Build-up, 0-8s)** of a 16-second story.\n\n"
            f"[BRAND PROFILE]\n{brand_profile_json}\n\n"
            f"INSTRUCTIONS:\n"
            f"- Focus on establishing the scene and building anticipation.\n"
            f"- Imagine this is ONE possible story among many for this brand.\n"
            f"- Choose a specific everyday situation for the target customer "
            f"that feels natural and relatable (e.g., busy workday break, weekend outing, late-night snack, etc.).\n"
            f"- **DO NOT** show the logo at the end.\n"
            f"- End with an action IN PROGRESS (e.g., hand reaching for food, about to take a bite).\n"
            f"- The viewer should want to see what happens next.\n"
            f"- Only Korean dialogue in [5.] should be in Korean."
        )

        messages_1 = [
            SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt_part1),
        ]
        ai_msg_1 = llm.invoke(messages_1)
        prompt_part1 = getattr(ai_msg_1, "content", "")

 
        # # [Part 2] 전-결 (Climax & Resolution) v1
        # user_prompt_part2 = (
        #     f"Now create the prompt for **PART 2 (전-결: Climax & Resolution, 8-16s)**.\n\n"
        #     f"It must continue DIRECTLY from Part 1. Here is the Part 1 summary:\n"
        #     f"---\n{prompt_part1[:800]}\n---\n\n"
        #     f"INSTRUCTIONS:\n"
        #     f"- **VISUAL MATCH:** Start exactly where Part 1 ended (same lighting, angle, character position).\n"
        #     f"- Show the action completing (e.g., taking the bite, drinking the coffee).\n"
        #     f"- Show emotional satisfaction on the character's face.\n"
        #     f"- **MUST** end with the brand logo and slogan narration.\n"
        #     f"- Only Korean dialogue in [5.] should be in Korean."
        # )


#############################################ㅇ요약을 시켰을떄 버전##################################
       
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


        # [Part 2] 전-결 (Climax & Resolution)
        user_prompt_part2 = (
            f"Now create the prompt for **PART 2 (전-결: Climax & Resolution, 8-16s)**.\n\n"
            f"It must continue DIRECTLY from Part 1. Here is a brief summary of PART 1:\n"
            f"---\n{part1_summary}\n---\n\n"
            f"INSTRUCTIONS:\n"
            f"- VISUAL MATCH: Start exactly where Part 1 ended (same lighting, angle, character position).\n"
            f"- Show the action completing (e.g., taking the bite, drinking the coffee).\n"
            f"- Show emotional satisfaction or relief in a way that fits this brand's tone.\n"
            f"- MUST end with the brand logo and slogan narration.\n"
            f"- This Part 2 should feel like the natural resolution of THIS specific Part 1 concept.\n"
            f"- Only Korean dialogue in [5.] should be in Korean."
        )
#####################################################################################


#         # v2
#         user_prompt_part2 = (
#     f"Now create the prompt for **PART 2 (전-결: Climax & Resolution, 8-16s)**.\n\n"
#     f"It must continue DIRECTLY from Part 1. Here is the Part 1 summary:\n"
#     f"---\n{prompt_part1[:800]}\n---\n\n"
#     f"INSTRUCTIONS:\n"
#     f"- VISUAL MATCH: Start exactly where Part 1 ended (same lighting, angle, character position).\n"
#     f"- Show the action completing (e.g., taking the bite, drinking the coffee).\n"
#     f"- Show emotional satisfaction or relief in a way that fits this brand's tone.\n"
#     f"- MUST end with the brand logo and slogan narration.\n"
#     f"- This Part 2 should feel like the natural resolution of THIS specific Part 1 concept.\n"
#     f"- Only Korean dialogue in [5.] should be in Korean."
# )


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




##################################꾸 꺼 ##########################################

# def make_generate_prompt_no_logo_node(llm: "BaseChatModel"):
#     """
#     로고를 사용하지 않는 경우의 숏폼 아이디어/프롬프트 생성 노드 팩토리.

#     - check_logo_node 에서 logo_usage_choice == "without_logo" 일 때 호출됨
#     - 기존 로고는 전혀 고려하지 않고, 브랜드 정보 + 사용자 요청만으로 숏폼 프롬프트를 생성한다.
#     """

#     def generate_prompt_no_logo_node(state: "AppState") -> Command[Literal["__end__"]]:
#         """
#         로고 없이 진행하는 숏폼 아이디어/프롬프트를 한 번 생성한다.
#         """
#         # 1) 컨텍스트 로드
#         brand_profile: "BrandProfile" = state.get("brand_profile") or {}
#         shorts_state: "ShortsState" = dict(state.get("shorts_state") or {})

#         # 마지막 사용자 발화
#         last_user_text = get_last_user_message(state)

#         # 브랜드 프로필을 JSON 문자열로 변환 (프롬프트에 그대로 보여주기 위함)
#         brand_profile_json = json.dumps(brand_profile, ensure_ascii=False, indent=2)

#         # 2) HumanMessage 내용 구성
#         user_prompt = (
#             f"Create an 8-second short-form video prompt based on the following brand information:\n\n"
#             f"[BRAND PROFILE]\n"
#             f"{brand_profile_json}\n\n"
#             f"Using the system instructions, create a single Veo 3.1 video prompt following the 7-section format.\n\n"
#             f"**CRITICAL: Write ALL sections in English. Only the Korean dialogue lines in section [5. DIALOGUE & NARRATION] should be in Korean.**"
#         )

#         messages = [
#             SystemMessage(content=PROMPT_GENERATION_SYSTEM_PROMPT),
#             HumanMessage(content=user_prompt),
#         ]

#         # 3) LLM 호출
#         ai_msg = llm.invoke(messages)

#         # 4) 생성된 프롬프트를 shorts_state 에도 저장
#         shorts_state["generated_prompt"] = getattr(ai_msg, "content", "")

#         return Command(
#             update={
#                 "messages": [ai_msg],
#                 "shorts_state": shorts_state,
#             },
#             goto=END,
#         )

#     return generate_prompt_no_logo_node