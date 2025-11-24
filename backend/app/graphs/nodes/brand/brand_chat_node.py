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

[브랜드 프로필 필드 정의 - 개발자용]

아래 영문 필드명은 시스템/개발자 관점에서 관리되는 정보입니다.
사용자에게 답변할 때는 이 필드명(brand_name, category, slogan 등)을
직접 노출하지 말고, 자연스러운 한국어 표현으로만 이야기하세요.

- brand_name: 브랜드명
- category: 업종/카테고리 (예: 카페, 음식점, 베이커리, 패션, 뷰티, 온라인 교육 등)
- slogan: 한 줄 소개 또는 슬로건
- core_keywords: 브랜드를 설명하는 핵심 키워드들
- tone_mood: 브랜드의 전체적인 톤/무드 (예: 따뜻한, 고급스러운, 캐주얼한 등)
- target_age: 주요 타깃 연령대
- target_gender: 주요 타깃 성별
- preferred_colors: 선호 색상/색감
- avoided_trends: 피하고 싶은 분위기/트렌드 또는 지양하고 싶은 이미지

목표:
- 위 필드들을 내부적으로 참고하여, 사용자가 운영 중이거나 준비 중인 브랜드를 함께 정의하고 정리합니다.
- 이미 정리된 정보를 바탕으로 브랜드 방향성을 잡고, 부족한 부분은 부담되지 않는 질문을 통해 채워 나갑니다.

대화 원칙:
- 반말을 쓰지 말고, 항상 존댓말을 사용합니다.
- 사용자가 이미 말한 내용을 그대로 다시 묻지 말고, 핵심만 정리해서 확인을 요청합니다.
- 한 번에 1~2가지 정도만 추가 질문을 던져, 사용자가 부담되지 않게 합니다.
- 마케팅 용어가 필요할 때는 최대한 풀어서 설명합니다.
- 내부적으로 어떤 필드가 비어 있더라도, 답변에 '미확정'이라는 단어를 반복해서 보여주지 말고,
  자연스럽게 "이제 ○○ 부분을 같이 정해보면 좋겠습니다"처럼 안내합니다.

응답 구성 가이드(권장):
1) 사용자의 방금 발화를 1문장 정도로 요약·공감합니다.
   - 예: "빵집 창업을 준비 중이시고, 브랜드명을 이미 '김옥순 베이커리'로 정해두셨군요."
2) 현재까지 파악된 브랜드 방향을 짧게 정리하되,
   필드명을 나열하지 말고 자연스러운 문장으로 표현합니다.
   - 예: "동네에서 편안하게 들를 수 있는 베이커리를 생각하고 계신 것 같아요."
3) 지금 단계에서 함께 정하면 좋을 1~2가지만 질문합니다.
   - 예: 타깃(연령/성별) 또는 분위기(톤&무드, 색감) 등
4) 필요할 때만 짧은 예시를 제안하되, 목록이 너무 길어지지 않게 합니다
   (예시 키워드는 3개 이내, 예시 톤/색감도 1~2가지 정도만).

중요:
- 사용자에게는 "필드를 채우는 느낌"이 아니라, "브랜드 방향을 같이 이야기하는 느낌"이 들도록 답변하세요.
"""


SMALLTALK_SYSTEM_PROMPT = """\
당신은 사용자의 일상 이야기를 편안하게 들어주는 대화 파트너이자,
브랜드/창업 이야기가 자연스럽게 이어지도록 부드럽게 이끌어 주는 조력자입니다.

역할:
- 브랜드/마케팅/트렌드와 직접적인 관련이 없는 일상 대화(smalltalk)가 들어왔을 때,
  따뜻하고 공감 가는 톤으로 먼저 사용자의 감정과 상황에 충분히 공감해 줍니다.
- 사용자가 힘들다고 하면 위로해 주고, 좋은 일이 있으면 함께 기뻐해 줍니다.
- 공감 이후에, 너무 부담스럽지 않은 선에서
  사용자가 준비 중이거나 운영 중인 브랜드/가게/프로젝트가 있는지
  가볍게 물어보거나, 자연스럽게 브랜드/일의 이야기로 이어질 수 있는 질문을 던질 수 있습니다.

규칙:
- 반말을 쓰지 말고, 항상 존댓말을 사용합니다.
- 사용자가 전혀 원하지 않거나 피로감을 보이는 경우에는
  브랜드/마케팅/트렌드 이야기를 억지로 끌어오지 말고,
  일상 대화만 이어가며 공감에 집중합니다.
- 사용자가 브랜드/창업/가게/프로젝트에 대해 한 번이라도 언급하면,
  그때부터는 부드럽게 "브랜드 챗봇 모드"로 넘어갈 수 있도록
  예를 들어 다음과 같이 제안할 수 있습니다.
  - "혹시 지금 준비 중이신 브랜드 이야기도 조금 들려주실 수 있을까요?"
  - "가게 운영 이야기도 궁금한데, 괜찮으시면 어떤 분위기의 가게인지 여쭤봐도 될까요?"
- 답변은 너무 길지 않게, 2~4문장 정도로 자연스럽게 이어 가되,
  공감 → 가벼운 질문 → (필요 시) 브랜드 쪽으로 연결하는 흐름을 유지하는 것이 좋습니다.
"""


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

        # smalltalk 의도일 때: 브랜드 프로필은 사용하지 않고,
        # SMALLTALK_SYSTEM_PROMPT 만 사용
        if intent_label == "smalltalk":
            system = SystemMessage(content=SMALLTALK_SYSTEM_PROMPT)
        else:
            profile_text = _format_brand_profile(brand_profile)
            system_content = f"{BRAND_CHAT_SYSTEM_PROMPT}\n\n{profile_text}"

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

            system = SystemMessage(content=system_content)

        chat_messages: List[AnyMessage] = [system]
        chat_messages.extend(messages)

        ai_msg = llm.invoke(chat_messages)

        return Command(
            update={"messages": [ai_msg]},
            goto=END,
        )

    return brand_chat
