# 브랜드 의도 분류 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, Any, Literal

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import Command

from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


_INTENTION_SYSTEM_PROMPT = """\
너는 '브랜드 챗봇' 대화에서 사용자의 의도를 분류하는 분류기야.

의도(label)는 아래 일곱 가지 중 하나만 선택해야 한다.

1) "smalltalk"
   - 브랜드/마케팅/트렌드와 거의 상관없는, 단순한 일상 대화일 때
   - 예)
     - "오늘 너무 피곤하네요."
     - "주말에 뭐 하세요?"
     - "그냥 심심해서 얘기해요."
     - "요즘 날씨 너무 춥지 않나요?"

2) "brand_info"
   - 브랜드 이름, 업종, 타깃, 톤앤매너, 키워드, 슬로건, 색감 등에 대해
     **새로 설명하거나 정보를 추가로 알려주는 내용**일 때
   - 이미 알려준 정보를 그대로 반복해서 다시 말하는 것도 포함된다.
   - 단, 기존 정보를 "**바꾸고 싶다 / 수정하고 싶다**"는 의도는
     "edit_brand" 로 분류해야 한다.

3) "edit_brand"
   - 이미 수집된 브랜드 정보 중 일부를 **수정/변경**하고 싶을 때
   - 예)
     - "브랜드 이름을 '김옥순 베이커리' 말고 '옥순이 빵집'으로 바꿀게요."
     - "업종을 카페 말고 베이커리로 정정할게요."
     - "톤앤매너를 편안한 느낌 말고 조금 더 고급스럽게 가져가고 싶어요."
   - 즉, 기존에 정리된 brand_profile 중 특정 필드를
     **다른 값으로 덮어쓰고 싶다는 의도**일 때 사용한다.

4) "trend_new"
   - 트렌드/시장/경쟁사/사례 등을 **처음** 물어보는 질문일 때
   - 이번 발화가 "트렌드 관련 리서치를 새로 요청"하는 경우
   - 예)
     - "요즘 카페 로고 디자인 트렌드가 어떤지 알려줘."
     - "베이커리 창업 트렌드 좀 정리해 줄 수 있어?"

5) "trend_retry"
   - 직전에 받은 트렌드 추천/요약이 크게 틀리진 않았지만,
     같은 조건으로 **다른 예시나 추가 추천**을 더 보고 싶을 때
   - 즉, 기존 질의(last_query)를 그대로 사용해서 다시 추천받고 싶은 경우
   - 예)
     - "방금 추천해 준 예시 말고 다른 스타일로도 좀 더 보여줘."
     - "비슷한 조건으로 다른 아이디어도 더 줄 수 있어?"

6) "trend_refine"
   - 트렌드/추천 결과를 받은 뒤, **조건을 바꿔서 재설정**하고 싶을 때
   - 예)
     - "색감을 더 어둡게 가고 싶어요."
     - "MZ 타깃보다는 40대 위주로 다시 추천해 줄래?"
     - "로고는 너무 귀여운 느낌 말고 조금 더 미니멀하게 바꿔줘."

7) "finalize"
   - 지금까지 정리된 브랜드 정보를 기반으로
     **이제 이대로 마무리/확정하고 싶다**는 의도가 강할 때
   - 예)
     - "이제 이 브랜드 컨셉으로 확정할게요."
     - "지금까지 정리한 내용으로 최종 정리해 줘."
   - 아직 필수 정보(브랜드 이름, 업종)가 비어 있을 수 있으므로,
     이 라벨은 "최종 정리를 원하는 의도"만 표현한다.
     실제로 필수 정보가 채워졌는지는 별도로 검증한다.

출력 형식(JSON):

{
  "intent": "trend_refine",
  "reason": "색감을 바꾸고 싶다는 피드백이 명확해서 trend_refine 으로 분류."
}

규칙:
- intent 값은 반드시 아래 중 하나여야 한다.
  - "smalltalk"
  - "brand_info"
  - "edit_brand"
  - "trend_new"
  - "trend_retry"
  - "trend_refine"
  - "finalize"

- reason 에는 왜 그렇게 분류했는지 한국어로 간단히 설명한다.
- JSON 바깥에 다른 텍스트를 절대 출력하지 말고,
  위에서 정의한 JSON 한 개만 출력한다.
"""


def make_brand_intention_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_intention 노드를 만들어 주는 팩토리.

    brand_agent 에서:

        llm = get_chat_model()
        brand_intention = make_brand_intention_node(llm)

    이런 식으로 사용할 예정.
    """

    def brand_intention(state: "AppState",) -> Command[Literal["brand_chat", "trend_search", "trend_refine", "brand_collect", "persist_brand",]]:
        """
        마지막 사용자 발화를 보고 의도를 분류해
        state.meta["intent"] 에 저장하고,
        다음에 실행할 노드를 Command.goto 로 결정하는 노드.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            # 유저 발화가 없으면 의도 분류할 수 없으니
            # 상태 변경 없이 brand_chat 으로 넘긴다.
            return Command(update={}, goto="brand_chat")

        # 참고용 컨텍스트 (필수는 아님)
        brand_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})
        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})

        profile_snippet = json.dumps(brand_profile, ensure_ascii=False)[:400]
        last_trend_summary = (trend_context.get("last_result_summary") or "")[:400]

        system_prompt = _INTENTION_SYSTEM_PROMPT + f"""

[참고 정보]

- 현재까지 정리된 브랜드 프로필 (일부):
{profile_snippet}

- 직전 트렌드 요약 (있다면):
{last_trend_summary}
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text),
        ]

        ai_msg = llm.invoke(messages)
        raw = (ai_msg.content or "").strip()

        # 기본값은 brand_info 로 둔다 (예전 동작과 최대한 비슷하게)
        label = "brand_info"
        reason = ""

        # JSON 파싱 시도
        try:
            parsed = json.loads(raw)
            intent_val = parsed.get("intent")
            if isinstance(intent_val, str):
                intent_val = intent_val.strip()
            allowed = (
                "smalltalk",
                "brand_info",
                "edit_brand", 
                "trend_new",
                "trend_retry",
                "trend_refine",
                "finalize",
            )

            if intent_val in allowed:
                label = intent_val
            reason_val = parsed.get("reason")
            if isinstance(reason_val, str):
                reason = reason_val.strip()
        except json.JSONDecodeError:
            # JSON 파싱 실패 시, 텍스트 안에서 label만 대충 뽑아보기
            lowered = raw.lower()
            if "smalltalk" in lowered:
                label = "smalltalk"
            elif "edit_brand" in lowered:
                label = "edit_brand"                
            elif "trend_retry" in lowered:
                label = "trend_retry"
            elif "trend_refine" in lowered:
                label = "trend_refine"
            elif "trend_new" in lowered:
                label = "trend_new"
            elif "finalize" in lowered:
                label = "finalize"
            else:
                label = "brand_info"

        new_meta: Dict[str, Any] = dict(state.get("meta") or {})
        new_meta["intent"] = {
            "label": label,
            "reason": reason,
            "raw": raw,
        }

        # --- 필수 필드 검증 (브랜드 이름, 업종) ---
        brand_profile_for_validation: Dict[str, Any] = dict(
            state.get("brand_profile") or {}
        )
        # BrandProfile 스키마 기준: brand_name, category
        brand_name = (brand_profile_for_validation.get("brand_name") or "").strip()
        category = (brand_profile_for_validation.get("category") or "").strip()

        required_missing = []
        if not brand_name:
            required_missing.append("brand_name")
        if not category:
            required_missing.append("category")

        validation = {
            # 예: ["brand_name"], ["category"], ["brand_name", "category"]
            "required_missing": required_missing,
            # 둘 다 채워져 있으면 True
            "is_valid": not required_missing,
        }

        new_meta["validation"] = validation

        is_valid = bool(validation.get("is_valid"))

        # 여기가 핵심: intent 에 따라 다음 노드 결정
        goto: Literal["brand_chat", "trend_search", "trend_refine", "brand_collect", "persist_brand",]

        if label in ("trend_new", "trend_retry"):
            goto = "trend_search"

        elif label == "trend_refine":
            goto = "trend_refine"

        elif label == "brand_info":
            goto = "brand_collect"

        elif label == "edit_brand":
            has_any_profile = bool(brand_profile_for_validation)
            if not has_any_profile:
                goto = "brand_chat"
            else:
                goto = "brand_collect"

        elif label == "finalize":
            if is_valid:
                goto = "persist_brand"
            else:
                goto = "brand_collect"

        else:
            # smalltalk / brand_info / 기타
            goto = "brand_chat"

        return Command(
            update={"meta": new_meta},
            goto=goto,
        )

    return brand_intention