"""사용자에게 수정 여부를 확인하는 노드."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from brandbot.state import SessionState
from brandbot.utils.tracing import log_state
from .edit_utils import FIELD_LABELS, format_value, ensure_list, LIST_FIELDS

_APPEND_HINT = "추가"
_REPLACE_HINT = "수정"
_SKIP_HINT = "건너뛰기"
_ACTION_LABEL = {
    "append": _APPEND_HINT,
    "replace": _REPLACE_HINT,
}


def _build_prompt(item: Dict[str, Any], remaining_count: int) -> str:
    label = item.get("label") or FIELD_LABELS.get(item.get("field", ""), item.get("field", "해당 항목"))
    action_hint = _ACTION_LABEL.get(item.get("action"), _REPLACE_HINT)
    current = format_value(item.get("current"))

    field = item.get("field")
    proposed = item.get("proposed")

    if field in LIST_FIELDS:
        proposed_list = ensure_list(proposed)
        append_candidates = item.get("append_candidates") or []
        proposed_text = ", ".join(proposed_list) if proposed_list else "없음"
        append_text = ", ".join(append_candidates) if append_candidates else proposed_text
        body = (
            f"{label} 항목을 {action_hint}하려는 요청으로 파악했어요.\n"
            f"현재 값: [{current}]\n"
            f"새로 제안된 값: [{proposed_text}]\n"
            f"새 값 중 기존에 없는 항목: [{append_text}]"
        )
    else:
        proposed_text = format_value(proposed)
        body = (
            f"{label} 항목을 {action_hint}하려는 요청으로 파악했어요.\n"
            f"현재 값: '{current}'\n"
            f"새로 제안된 값: '{proposed_text}'"
        )

    suffix = (
        "\n\n어떻게 할까요?\n"
        f"- '{_REPLACE_HINT}'이라고 답하면 기존 값을 새 값으로 교체합니다.\n"
        f"- '{_APPEND_HINT}'이라고 답하면 새 값을 기존에 덧붙입니다.\n"
        f"- '{_SKIP_HINT}'이라고 답하면 이번 변경은 적용하지 않습니다."
    )

    if remaining_count > 1:
        suffix += f"\n\n(남은 수정 항목 {remaining_count - 1}건)"
    else:
        suffix += f"\n\n(추천 선택: '{action_hint}')"

    return body + suffix


async def edit_confirm(state: SessionState) -> SessionState:
    pending = deepcopy(state.get("pending_edit") or {})
    items = pending.get("items") or []
    index = pending.get("index", 0)

    if not items or index >= len(items):
        # 처리할 항목이 없으면 기본 플로우로 복귀
        log_state(state, "edit_confirm:empty", pending=pending)
        return {
            "pending_edit": {},
            "_intent": "collect",
            "edit_choice_retry": False,
        }

    item = items[index]
    message = _build_prompt(item, len(items) - index)

    pending["status"] = "awaiting_choice"
    log_state(state, "edit_confirm:prompt", item=item, index=index, total=len(items))

    return {
        "pending_edit": pending,
        "_intent": "edit_choice",
        "snapshot_text": message,
        "edit_choice_retry": False,
    }

