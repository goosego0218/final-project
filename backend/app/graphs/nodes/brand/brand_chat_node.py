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
                    "위 트렌드 분석 텍스트를 거의 그대로 사용자에게 보여주세요. "
                    "본문에 있는 문장 구조와 URL, 리스트 포맷은 절대 변경하지 마세요."
                )

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
                    "  예: '브랜드 방향을 더 구체화할 수도 있고, 또는 생성하기 버튼을 클릭하여 브랜드 프로필을 확정하고 로고나 쇼츠를 만들러 갈 수 있어요.'\n"
                    "  예: '혹시 어떤 분위기나 느낌을 원하시나요? 예를 들어, 따뜻한 느낌이나 고급스러운 느낌 등 어떤 것을 생각하고 계신가요? "
                    "또는 생성하기 버튼을 클릭하여 브랜드 프로필을 확정하고 로고나 쇼츠를 만들러 갈 수 있어요.'\n"
                    "- 사용자가 옵션값 질문에 답변하지 않거나, '다음 단계', '확정', '이대로 진행', "
                    "'쇼츠 만들고 싶다', '로고 만들고 싶다' 등의 의사를 표현하면,\n"
                    "  먼저 지금까지 정리된 내용만으로도 브랜드 프로필을 확정하고 다음 단계로 넘어갈 수 있다는 점을 안내하세요.\n"
                    "  그 다음, 현재 브랜드 프로필에서 **실제로 아직 입력되지 않은 옵션 항목들만** 골라 짧게 예시로 언급하세요.\n"
                    "  (예: 톤앤무드, 타겟 연령/성별, 슬로건, 핵심 키워드, 피하고 싶은 트렌드, 선호 색상 중에서\n"
                    "   값이 비어 있는 항목만 선택해서 말하세요.)\n"
                    "  그런 뒤, '지금 상태로 바로 확정해서 다음 단계(로고/쇼츠 생성)로 넘어갈지, 아니면 이런 항목들도 조금 더 정리해 보고 확정할지'를 선택하도록 질문하세요.\n"
                    "  예: '지금까지 이야기해 주신 내용만으로도 브랜드 프로필을 확정하고 다음 단계(로고·쇼츠 생성)로 넘어갈 수 있습니다.\n"
                    "       다만 현재 프로필을 보면 톤앤무드, 슬로건, 선호 색상처럼 아직 입력되지 않은 항목들이 몇 가지 있어요.\n"
                    "       지금 상태로 바로 확정해서 넘어가실까요, 아니면 이런 항목들도 조금만 더 이야기해 보고 확정하실까요?'\n"
                    "- 필수값이 채워진 상태에서 옵션값 질문을 2~3회 한 후에는, 위와 같은 방식으로 자연스럽게 확정 여부와 "
                    "남은 항목 추가 수집 중에서 선택하도록 유도하세요."
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
