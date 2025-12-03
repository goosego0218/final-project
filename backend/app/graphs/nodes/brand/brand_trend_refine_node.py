# 브랜드 에이전트용 트렌드 "수정 후 재추천" 준비 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, Any, List, Literal

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import Command

from app.graphs.nodes.common.message_utils import get_last_user_message
from app.graphs.nodes.brand.prompt.brand_trend_refine_node_prompts import _TREND_REFINE_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_brand_trend_refine_node(llm: "BaseChatModel"):
    """
    trend_refine 의도일 때 실행되는 노드.
    - trend_context.last_query / constraints / round 등을 업데이트해서
      바로 뒤에서 trend_search 노드가 다시 호출될 수 있도록 준비한다.
    """

    def trend_refine(state: "AppState") -> Command[Literal["trend_search"]]:
        """
        마지막 사용자 발화를 피드백으로 받아,
        - trend_context.last_query 를 수정하고
        - trend_context.constraints 를 누적하고
        - trend_context.round 를 증가시키는 노드.
        """
        user_text = get_last_user_message(state)
        if not user_text:
            return Command(update={}, goto="trend_search")

        trend_context: Dict[str, Any] = dict(state.get("trend_context") or {})
        last_query: str = trend_context.get("last_query") or ""
        last_summary: str = trend_context.get("last_result_summary") or ""

        if not last_query and not last_summary:
            trend_context["last_query"] = user_text
            trend_context.setdefault("constraints", [])
            trend_context["round"] = int(trend_context.get("round") or 0) + 1

            return Command(
                update={"trend_context": trend_context},
                goto="trend_search",
            )

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

        return Command(
            update={
                "trend_context": trend_context,
            },
            goto="trend_search",
        )

    return trend_refine