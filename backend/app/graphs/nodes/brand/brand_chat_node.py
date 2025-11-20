# 브랜드 메인 챗 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from __future__ import annotations

from typing import TYPE_CHECKING, List

from langchain_core.messages import SystemMessage, AnyMessage

if TYPE_CHECKING:
    from app.agents.state import AppState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def _format_brand_profile(profile: "BrandProfile") -> str:
    """브랜드 프로필을 LLM 프롬프트용 텍스트로 정리."""
    if not profile:
        return "아직 확정된 브랜드 정보가 거의 없습니다. 사용자의 답변을 바탕으로 천천히 정리해 주세요."

    lines = ["현재까지 파악된 브랜드 정보:"]

    name = profile.get("brand_name")
    if name:
        lines.append(f"- 브랜드명: {name}")

    category = profile.get("category")
    if category:
        lines.append(f"- 업종/카테고리: {category}")

    tone = profile.get("tone_mood")
    if tone:
        lines.append(f"- 톤/분위기: {tone}")

    keywords = profile.get("core_keywords")
    if keywords:
        lines.append(f"- 핵심 키워드: {keywords}")

    slogan = profile.get("slogan")
    if slogan:
        lines.append(f"- 슬로건/한 줄 소개: {slogan}")

    target_age = profile.get("target_age")
    if target_age:
        lines.append(f"- 타깃 연령대: {target_age}")

    target_gender = profile.get("target_gender")
    if target_gender:
        lines.append(f"- 타깃 성별: {target_gender}")

    avoided = profile.get("avoided_trends")
    if avoided:
        lines.append(f"- 피하고 싶은 분위기/트렌드: {avoided}")

    colors = profile.get("preferred_colors")
    if colors:
        lines.append(f"- 선호 색상/색감: {colors}")

    return "\n".join(lines)


BRAND_CHAT_SYSTEM_PROMPT = """\
당신은 한국 소상공인과 1인 창업자를 돕는 브랜드 마케팅 컨설턴트입니다.

목표:
- 사용자가 운영 중이거나 준비 중인 브랜드를 함께 정의하고 정리합니다.
- 이미 정리된 브랜드 정보(브랜드명, 업종, 타깃, 톤앤매너, 키워드, 슬로건, 색감 등)를 바탕으로
  브랜드 방향성을 잡고, 부족한 부분은 질문을 통해 채워 나갑니다.

대화 원칙:
- 반말을 쓰지 말고, 항상 존댓말을 사용합니다.
- 사용자가 이미 말한 내용을 다시 묻지 말고, 정리해서 확인을 요청합니다.
- 한 번에 1~2가지 정도만 추가 질문을 던져, 사용자가 부담되지 않게 합니다.
- 마케팅 용어가 필요할 때는 최대한 풀어서 설명합니다.
- 사용자가 당장 정답을 모르더라도, 예시를 들어가며 선택할 수 있게 도와줍니다.

응답 구성 가이드(권장):
1) 사용자의 방금 발화를 간단히 요약/공감
2) 현재까지 파악된 브랜드 정보를 짧게 정리 (중요하거나 새로 확정된 내용 위주)
3) 다음 단계에서 함께 정리하면 좋을 1~2가지 질문 제안
"""


def make_brand_chat_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_chat 노드를 만들어 주는 팩토리.

    brand_agent 에서:

        llm = get_chat_model()
        brand_chat = make_brand_chat_node(llm)

    이런 식으로 사용.
    """

    def brand_chat(state: "AppState") -> "AppState":
        """
        브랜드 관련 대화를 진행하는 메인 챗 노드.

        - state.messages: 대화 히스토리
        - state.brand_profile: 지금까지 모인 브랜드 정보
        """
        messages: List[AnyMessage] = list(state.get("messages") or [])
        brand_profile = state.get("brand_profile") or {}

        profile_text = _format_brand_profile(brand_profile)

        system = SystemMessage(
            content=f"{BRAND_CHAT_SYSTEM_PROMPT}\n\n{profile_text}"
        )

        chat_messages: List[AnyMessage] = [system]
        chat_messages.extend(messages)

        ai_msg = llm.invoke(chat_messages)

        return {
            "messages": [ai_msg],
        }

    return brand_chat
