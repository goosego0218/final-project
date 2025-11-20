# 브랜드 의도 분류 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, Any

from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


_INTENTION_SYSTEM_PROMPT = """\
너는 '브랜드 챗봇' 대화에서 사용자의 의도를 분류하는 분류기야.

의도(label)는 아래 다섯 가지 중 하나만 선택해야 한다.

1) "smalltalk"
   - 브랜드/마케팅/트렌드와 거의 상관없는, 단순한 일상 대화일 때
   - 예)
     - "오늘 너무 피곤하네요."
     - "주말에 뭐 하세요?"
     - "그냥 심심해서 얘기해요."

2) "brand_info"
   - 브랜드 이름, 업종, 타깃, 톤앤매너, 키워드, 슬로건, 색감 등에 대해 말하거나
   - 그 정보를 새로 알려주거나, 수정/변경하려는 내용일 때
   - 예)
     - "브랜드 이름은 봉봉 커피로 할게요."
     - "타깃은 20~30대 직장인 위주로 보고 있어요."
     - "좀 더 고급스러운 느낌으로 바꾸고 싶어요."

3) "trend_new"
   - 트렌드/시장/경쟁사/사례 등을 **처음** 물어보는 질문일 때
   - 즉, 이번 발화가 "트렌드 관련 리서치를 새로 요청"하는 경우
   - 예)
     - "요즘 카페 로고 트렌드가 어떤지 알려줘."
     - "2025년 인스타 릴스 숏폼 인기 스타일 좀 알려줄래?"
     - "브랜드랑 잘 맞는 로고 스타일 트렌드를 추천해줘."

4) "trend_refine"
   - 직전에 받은 **트렌드 추천/요약이 마음에 안 들거나**, 거기서 조건을 바꿔서
     다시 추천/수정해 달라는 경우
   - 예)
     - "너가 추천해준 스타일은 너무 화려해서 별로야. 더 미니멀하게 다시 추천해줘."
     - "색감이 너무 어두운데, 밝은 쪽으로 다시 추천해줘."
     - "방금 내용에서 10대 타깃은 빼고 다시 정리해줘."

5) "finalize"
   - 지금까지 정리된 브랜드 방향/정보를 이대로 **확정하고 싶다**는 의도가 강할 때
   - 예)
     - "이 정도면 된 것 같아요. 이렇게 확정할게요."
     - "이대로 저장해 주세요."
     - "이 방향으로 최종 정리해 주세요."

출력 형식:
- 반드시 JSON 한 개만 출력해.
- 형식 예시는 아래와 같다.

{
  "intent": "brand_info",
  "reason": "브랜드명과 타깃에 대한 정보를 구체적으로 말하고 있어서 brand_info로 분류."
}

규칙:
- intent 값은 반드시 위 다섯 가지 중 하나여야 한다.
  - "smalltalk" / "brand_info" / "trend_new" / "trend_refine" / "finalize"
- reason 은 한국어 한두 문장으로, 왜 그렇게 분류했는지 간단히 적어줘.
"""


def make_brand_intention_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_intention 노드를 만들어 주는 팩토리.

    brand_agent 에서:

        llm = get_chat_model()
        brand_intention = make_brand_intention_node(llm)

    이런 식으로 사용할 예정.
    """

    def brand_intention(state: "AppState") -> "AppState":
        """
        마지막 사용자 발화를 보고 의도를 분류해
        state.meta["intent"] 에 저장하는 노드.

        - 그래프 분기는 이후 단계에서 사용할 예정이고,
          지금은 meta 에만 기록해 둔다.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            # 유저 발화가 없으면 의도 분류할 수 없음
            return {}

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
            allowed = ("smalltalk", "brand_info", "trend_new", "trend_refine", "finalize")
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

        return {"meta": new_meta}

    return brand_intention
