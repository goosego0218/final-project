# 브랜드 메인 챗 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

from typing import TYPE_CHECKING, List, Dict, Any, Literal

from langchain_core.messages import SystemMessage, AnyMessage
from langgraph.types import Command
from langgraph.graph import END

from app.graphs.nodes.brand.prompt.brand_chat_node_prompts import (
    BRAND_CHAT_SYSTEM_PROMPT,
    SMALLTALK_SYSTEM_PROMPT,
)

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


def make_brand_chat_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_chat 노드를 만들어 주는 팩토리.
    """

    def brand_chat(state: "AppState") -> Command[Literal["__end__"]]:
        """
        브랜드 관련 대화를 진행하는 메인 챗 노드.

        - state.messages: 대화 히스토리
        - state.brand_profile: 지금까지 모인 브랜드 정보
        - state.meta.intent.label == "smalltalk" 이면
          → 브랜드 컨설턴트가 아니라 일상 대화 파트너 모드로 응답.
        """
        messages: List[AnyMessage] = list(state.get("messages") or [])
        brand_profile = state.get("brand_profile") or {}

        meta: Dict[str, Any] = dict(state.get("meta") or {})
        intent_label = None
        intent_info = meta.get("intent") or {}
        if isinstance(intent_info, dict):
            il = intent_info.get("label")
            if isinstance(il, str):
                intent_label = il

        # 필수 필드 검증 결과(meta["validation"]) 읽기
        validation: Dict[str, Any] = dict(meta.get("validation") or {})
        required_missing = validation.get("required_missing") or []
        is_valid = bool(validation.get("is_valid", True))

        # 사람이 읽을 수 있는 한국어 라벨로 매핑
        # BrandProfile 기준: brand_name, category
        missing_labels: List[str] = []
        if "brand_name" in required_missing:
            missing_labels.append("브랜드 이름")
        if "category" in required_missing:
            missing_labels.append("업종")

        # trend_context 확인 (트렌드 검색 결과가 있는지 체크)
        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})
        trend_summary: str = str(trend_context.get("last_result_summary") or "")

        # smalltalk 의도일 때: 브랜드 프로필은 사용하지 않고,
        # SMALLTALK_SYSTEM_PROMPT 만 사용
        if intent_label == "smalltalk":
            system = SystemMessage(content=SMALLTALK_SYSTEM_PROMPT)
        else:
            profile_text = _format_brand_profile(brand_profile)
            system_content = f"{BRAND_CHAT_SYSTEM_PROMPT}\n\n{profile_text}"

            if intent_label and intent_label.startswith("trend") and trend_summary:
                system_content += (
                    "\n\n[트렌드 분석 결과]\n"
                    f"{trend_summary}\n\n"
                    "[지시]\n"
                    "위 트렌드 분석 내용을 참고하여, 사용자가 이해하기 쉽게 설명하고 "
                    "브랜드/콘텐츠 방향에 대한 구체적인 실행 아이디어를 제안하세요. "
                    "가능하면 트렌드 텍스트의 핵심 문장과 URL은 그대로 유지하세요."
                )

            # finalize + 필수 필드 검증 결과에 따른 추가 지시
            if intent_label == "finalize":
                if not is_valid:
                    # 필수 항목이 비어 있을 때: 먼저 부족한 필드를 물어보도록 유도
                    if missing_labels:
                        missing_text = ", ".join(missing_labels)
                    else:
                        missing_text = "브랜드 이름, 업종"
                    system_content += (
                        "\n\n[필수 정보 보완 지시]\n"
                        "브랜드를 최종 정리하기 전에, 다음 필수 항목이 아직 정리되지 않았습니다: "
                        f"{missing_text}.\n"
                        "사용자에게 자연스럽게 다시 질문해서 이 정보를 먼저 채워 넣으세요. "
                        "이미 사용자가 말한 내용과 충돌하는 경우, 사용자가 방금 말한 최신 내용을 우선합니다."
                    )
                else:
                    # 필수 항목이 모두 채워진 상태: 요약 + 확정 여부 확인
                    system_content += (
                        "\n\n[브랜드 확정 지시]\n"
                        "현재 brand_profile 에 필수 정보(브랜드 이름, 업종)가 모두 채워져 있습니다.\n"
                        "지금까지 모인 브랜드 정보를 간단히 요약해 주고, "
                        "\"이대로 브랜드를 확정해도 될까요?\" 라고 자연스럽게 확인 질문을 던지세요."
                    )
            else:
                # finalize 는 아니지만 필수 항목이 비어 있는 경우: 대화 중에 자연스럽게 보완
                if required_missing and missing_labels:
                    missing_text = ", ".join(missing_labels)
                    system_content += (
                        "\n\n[부족 정보 안내]\n"
                        "브랜드 대화를 이어가면서, 다음 필수 항목도 자연스럽게 질문해서 채워 넣으세요: "
                        f"{missing_text}."
                    )
                elif is_valid:
                    # 필수 항목이 모두 채워진 상태: 옵션값은 선택사항
                    system_content += (
                        "\n\n[필수값 완료 상태 안내 - 반드시 준수]\n"
                        "현재 필수 정보(브랜드 이름, 업종)가 모두 채워져 있습니다.\n"
                        "옵션값(톤앤무드, 타겟 연령, 타겟 성별, 슬로건, 핵심 키워드, 피하고 싶은 트렌드, 선호 색상)은 선택사항입니다.\n"
                        "- 옵션값에 대해 1~2가지만 자연스럽게 질문할 수 있지만, 모든 옵션값을 채우려고 강요하지 마세요.\n"
                        "- **중요: 필수값이 채워진 후 첫 번째 응답에서 반드시 옵션값 질문과 함께 또는 같은 문장에, "
                        "다음 단계(쇼츠/로고 생성)로 넘어갈 수 있다는 것을 명시적으로 안내해야 합니다.**\n"
                        "  이 안내를 생략하지 마세요. 반드시 포함시켜야 합니다.\n"
                        "  예: '이제 브랜드의 방향성을 좀 더 구체화하거나 쇼츠 또는 로고를 생성할 수 있습니다.'\n"
                        "  예: '브랜드 방향을 더 구체화할 수도 있고, 바로 쇼츠나 로고를 만들어볼 수도 있어요.'\n"
                        "  예: '혹시 어떤 분위기나 느낌을 원하시나요? 예를 들어, 따뜻한 느낌이나 고급스러운 느낌 등 어떤 것을 생각하고 계신가요? "
                        "또는 바로 쇼츠나 로고를 만들어볼 수도 있어요.'\n"
                        "- 사용자가 옵션값 질문에 답변하지 않거나, '다음 단계', '확정', '이대로 진행', "
                        "'쇼츠 만들고 싶다', '로고 만들고 싶다' 등의 의사를 표현하면,\n"
                        "  즉시 옵션값 질문을 중단하고 '이대로 브랜드를 확정해도 될까요?'라고 확인 질문을 던지세요.\n"
                        "- 필수값이 채워진 상태에서 옵션값 질문을 2~3회 한 후에는 자동으로 확정 여부를 확인하는 방향으로 전환하세요."
                    )

            system = SystemMessage(content=system_content)

        chat_messages: List[AnyMessage] = [system]
        chat_messages.extend(messages)

        ai_msg = llm.invoke(chat_messages)

        return Command(
            update={"messages": [ai_msg]},
            goto=END,
        )

    return brand_chat
