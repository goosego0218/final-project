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

의도(label)는 아래 여섯 가지 중 하나만 선택해야 한다.

1) "smalltalk"
   - 브랜드/마케팅/트렌드와 거의 상관없는, 단순한 일상 대화일 때
   - 예)
     - "오늘 너무 피곤하네요."
     - "주말에 뭐 하세요?"
     - "그냥 심심해서 얘기해요."

2) "brand_info"
   - 브랜드 이름, 업종, 타깃, 톤앤매너, 키워드, 슬로건, 색감 등에 대해 말하거나
   - 그 정보를 새로 알려주거나, 수정/변경하려는 내용일 때

3) "trend_new"
   - 트렌드/시장/경쟁사/사례 등을 **처음** 물어보는 질문일 때
   - 이번 발화가 "트렌드 관련 리서치를 새로 요청"하는 경우

4) "trend_retry"
   - 직전에 받은 트렌드 추천/요약이 크게 틀리진 않았지만,
     같은 조건으로 다른 예시나 추가 추천을 더 보고 싶을 때
   - 즉, **기존 질의(last_query)를 그대로 사용해서 다시 추천받고 싶은 경우**
   - 예)
     - "지금 추천해준 스타일 말고 다른 예시도 더 보여줘."
     - "비슷한 느낌으로 몇 가지 더 추천해줄 수 있어?"

5) "trend_refine"
   - 직전에 받은 트렌드 추천/요약에서
     마음에 안 드는 부분을 **조건/방향을 바꿔서 다시 추천받고 싶은 경우**
   - 즉, **기존 질의에 사용자의 피드백을 반영해 질의를 수정해서** 다시 추천받는 경우
   - 예)
     - "너무 어두운 느낌이라 별로예요. 더 밝은 색감 위주로 다시 추천해 주세요."
     - "10대 타깃은 빼고, 20~30대 직장인 위주로 다시 잡아주세요."
     - "지금은 너무 고급스러워서 부담돼요. 좀 더 친근한 동네 카페 느낌으로 바꿔 주세요."

6) "finalize"
   - 지금까지 정리된 브랜드 방향/정보를 이대로 **확정하고 싶다**는 의도가 강할 때

출력 형식:
{
  "intent": "trend_refine",
  "reason": "색감을 바꾸고 싶다는 피드백이 명확해서 trend_refine 으로 분류."
}

규칙:
- intent 값은 반드시 아래 중 하나여야 한다.
  - "smalltalk" / "brand_info" / "trend_new" / "trend_retry" / "trend_refine" / "finalize"
...
"""


def make_brand_intention_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_intention 노드를 만들어 주는 팩토리.

    brand_agent 에서:

        llm = get_chat_model()
        brand_intention = make_brand_intention_node(llm)

    이런 식으로 사용할 예정.
    """

    def brand_intention(state: "AppState") -> Command[Literal["brand_chat", "trend_search", "trend_refine"]]:
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

        # 여기가 핵심: intent 에 따라 다음 노드 결정
        goto: Literal["brand_chat", "trend_search", "trend_refine"]

        if label in ("trend_new", "trend_retry"):
            goto = "trend_search"
        elif label == "trend_refine":
            goto = "trend_refine"
        else:
            # smalltalk / brand_info / finalize / 기타
            goto = "brand_chat"

        return Command(
            update={"meta": new_meta},
            goto=goto,
        )

    return brand_intention