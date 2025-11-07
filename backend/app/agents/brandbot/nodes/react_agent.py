# src/brandbot/nodes/react_agent.py
from __future__ import annotations
from typing import Dict, Any, Literal, Optional
from pydantic import BaseModel, Field
from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM
from brandbot.react import tools as T

# 에이전트가 선택할 수 있는 액션
ActionName = Literal[
    "collect", "validate_required", "trend_brief",
    "optional_recommend", "optional_pick",
    "emit_snapshot", "persist_project", "finish"
]

class Plan(BaseModel):
    thought: str = Field(description="다음에 무엇을 할지 간단한 계획")
    action: ActionName = Field(description="실행할 도구 이름 또는 'finish'")
    input: Optional[Dict[str, Any]] = Field(default=None, description="도구 입력 파라미터")
    say: Optional[str] = Field(default=None, description="사용자에게 보여줄 문장(있다면)")

PROMPT_SYS = (
    "너는 브랜드 기획 챗봇 ReAct 에이전트다. Thought→Action→Observation 루프를 수행한다.\n"
    "필수 필드(name, industry, tone, keywords)가 모두 채워지기 전에는 'persist_project'를 호출하지 말라.\n"
    "추천은 사용자가 원할 때만(optional_recommend/optional_pick)을 사용한다.\n"
    "각 단계에서 JSON 한 줄(Plan)만 출력하라."
    "\n\n사용 가능한 액션:\n"
    "- collect: 사용자의 최신 발화를 분석하여 brand_draft를 보수적으로 업데이트\n"
    "- validate_required: 필수 필드 충족 여부 검사\n"
    "- trend_brief: 업종/분위기 기반 트렌드 간략 제안(요청 시)\n"
    "- optional_recommend: 선택항목 후보 생성(요청 시)\n"
    "- optional_pick: 사용자가 고른(또는 수정한) 선택항목 값을 draft에 반영\n"
    "- emit_snapshot: 현재 상태로 스냅샷 텍스트 생성\n"
    "- persist_project: 필수 충족 시 프로젝트 확정\n"
    "- finish: 루프 종료(더 이상 할 일이 없거나 emit_snapshot 이후)\n"
)

def _tool_map():
    return {
        "collect": T.t_collect,
        "validate_required": T.t_validate_required,
        "trend_brief": T.t_trend_brief,
        "optional_recommend": T.t_optional_recommend,
        "optional_pick": T.t_optional_pick,
        "emit_snapshot": T.t_emit_snapshot,
        "persist_project": T.t_persist_project,
    }

async def react_agent(state: SessionState) -> SessionState:
    llm = LLM()
    tools = _tool_map()
    obs: str = ""
    max_steps = 4

    for step in range(max_steps):
        # 1) 계획 수립
        user = last_user_text(state) or ""
        context = {
            "brand_draft": state.get("brand_draft") or {},
            "required_ok": state.get("required_ok"),
            "_missing_required": state.get("_missing_required") or [],
            "_trend_ready": state.get("_trend_ready"),
            "observation": obs,
            "user_text": user,
        }
        plan_prompt = (
            PROMPT_SYS
            + "\n\n[대화 입력]\n"
            + user
            + "\n\n[현재 상태]\n"
            + str(context)
            + "\n\nJSON Plan만 출력:"
        )
        planner = llm.llm.with_structured_output(Plan, method="function_calling")
        plan: Plan = await planner.ainvoke(plan_prompt)

        if plan.say:
            # 사용자에게 바로 보여줄 말이 있다면 누적
            state["assistant_text"] = (state.get("assistant_text") or "") + str(plan.say) + "\n"

        if plan.action == "finish":
            break

        # 2) 액션 실행
        func = tools.get(plan.action)
        if not func:
            obs = f"Unknown action: {plan.action}"
            continue

        try:
            res = await func(state, **(plan.input or {}))
            # 3) 상태 병합
            for k, v in (res or {}).items():
                # 안전 병합 규칙(덮어도 무방한 키만)
                if k in ("brand_draft","trend_brief","optional_candidates",
                         "required_ok","_missing_required","_trend_ready",
                         "snapshot_text","project_id","confirmed"):
                    state[k] = v
            # 4) 관찰 요약
            if "snapshot_text" in res:
                obs = "snapshot_updated"
            elif "project_id" in res:
                obs = f"persisted:{res['project_id']}"
            else:
                obs = "ok"
        except Exception as e:
            obs = f"error:{type(e).__name__}"

    # 루프가 끝나도 스냅샷이 없으면 최소 스냅샷 생성
    if not state.get("snapshot_text"):
        snap = await T.t_emit_snapshot(state)
        state.update(snap or {})

    return state
