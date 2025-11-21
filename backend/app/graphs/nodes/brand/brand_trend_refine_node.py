# 브랜드 에이전트용 트렌드 "수정 후 재추천" 준비 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, Any, List

from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


_TREND_REFINE_SYSTEM_PROMPT = """\
너는 '브랜드 트렌드 추천 결과'에 대해 사용자의 피드백을 받아,
어떤 점을 수정해서 다시 추천해야 할지 정리해 주는 계획 수립 담당자야.

입력:
- 이전 트렌드 질의문 (last_query)
- 이전 트렌드 요약/추천 내용 (last_result_summary)
- 사용자의 최신 발화 (feedback): 무엇이 마음에 들지 않는지, 어떻게 바꾸고 싶은지

출력:
- 반드시 JSON 형식 한 개로만 출력해야 한다.
- 형식 예시는 다음과 같다.

{
  "new_query": "이전 질의를 어떻게 수정해서 다시 검색할지에 대한 한 문장짜리 질의문",
  "constraints": [
    "사용자가 요청한 조건 1",
    "사용자가 요청한 조건 2"
  ],
  "reason": "왜 이렇게 수정했는지에 대한 한국어 설명"
}

규칙:
1) new_query:
   - 이전 질의문(last_query)에 사용자의 피드백을 반영해 다시 정리한 한 문장짜리 질의문이다.
   - 트렌드 검색 API에서 그대로 사용 가능한 자연스러운 한국어 문장으로 작성한다.
2) constraints:
   - 사용자가 추가로 요구한 조건/제약사항을 리스트로 정리한다.
   - 예: "색감은 더 밝게", "10대 타깃은 제외", "너무 고급스러움은 피하기"
3) reason:
   - 왜 이런 방향으로 질의를 수정했는지 한국어 한두 문장으로 설명한다.

주의:
- JSON 이외의 텍스트를 함께 출력하지 말 것.
- last_query와 last_result_summary가 비어 있더라도,
  사용자의 최신 발화를 바탕으로 new_query와 constraints를 최대한 합리적으로 채워라.
"""


def make_brand_trend_refine_node(llm: "BaseChatModel"):
    """
    trend_refine 의도일 때 실행되는 노드.
    - trend_context.last_query / constraints / round 등을 업데이트해서
      바로 뒤에서 trend_search 노드가 다시 호출될 수 있도록 준비한다.
    """

    def trend_refine(state: "AppState") -> "AppState":
        """
        마지막 사용자 발화를 피드백으로 받아,
        - trend_context.last_query 를 수정하고
        - trend_context.constraints 를 누적하고
        - trend_context.round 를 증가시키는 노드.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            return {}

        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})
        last_query: str = trend_context.get("last_query") or ""
        last_summary: str = trend_context.get("last_result_summary") or ""

        # 이전 정보가 전혀 없는 상태에서 refine 이 들어온 경우:
        # → 이번 발화를 기반으로 새로운 질의를 시작하는 방향으로 처리
        if not last_query and not last_summary:
            trend_context["last_query"] = user_text
            trend_context.setdefault("constraints", [])
            trend_context["round"] = int(trend_context.get("round") or 0) + 1
            return {"trend_context": trend_context}

        system_prompt = _TREND_REFINE_SYSTEM_PROMPT + f"""

[이전 트렌드 질의문]
{last_query}

[이전 트렌드 요약/추천 내용]
{last_summary}

[사용자의 최신 피드백(발화)]
{user_text}
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content="위 정보를 바탕으로 new_query, constraints, reason 을 JSON 으로 만들어줘."),
        ]

        ai_msg = llm.invoke(messages)
        raw = (ai_msg.content or "").strip()

        new_query = last_query or user_text
        new_constraints: List[str] = []
        reason = ""

        # JSON 파싱 시도
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                nq = parsed.get("new_query")
                if isinstance(nq, str) and nq.strip():
                    new_query = nq.strip()

                cs = parsed.get("constraints")
                if isinstance(cs, list):
                    new_constraints = [str(c).strip() for c in cs if str(c).strip()]

                rs = parsed.get("reason")
                if isinstance(rs, str):
                    reason = rs.strip()
        except json.JSONDecodeError:
            # 파싱 실패 시, 피드백을 포함한 단순한 질의로 fallback
            new_query = f"{last_query}\n사용자 피드백: {user_text}".strip()

        merged_constraints: List[str] = list(trend_context.get("constraints") or [])
        merged_constraints.extend(new_constraints)

        trend_context["last_query"] = new_query
        trend_context["constraints"] = merged_constraints
        trend_context["round"] = int(trend_context.get("round") or 0) + 1
        trend_context["last_refine_reason"] = reason

        return {
            "trend_context": trend_context,
        }

    return trend_refine