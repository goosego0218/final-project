"""사용자의 수정/추가/건너뛰기 선택을 적용하는 노드."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from brandbot.state import SessionState, last_user_text
from brandbot.utils.tracing import log_state
from .edit_utils import FIELD_LABELS, LIST_FIELDS, ensure_list, format_value

REPLACE_KEYWORDS = ("수정", "변경", "바꿔", "바꿀", "교체", "대체", "새로", "갱신", "덮어", "교환")
APPEND_KEYWORDS = ("추가", "더해", "보태", "합쳐", "넣어", "더 넣", "붙여", "곁들여")
SKIP_KEYWORDS = ("건너", "넘겨", "취소", "유지", "그대로", "하지마", "패스", "미루")
CONFIRM_KEYWORDS = ("그래", "좋아", "응", "맞아", "맞습니다", "오케이", "좋습니다", "알았어", "네")
ACTION_LABEL = {"replace": "수정", "append": "추가"}


def _detect_action(text: str) -> str | None:
    low = text.lower()

    if any(keyword in low for keyword in REPLACE_KEYWORDS):
        return "replace"
    if any(keyword in low for keyword in APPEND_KEYWORDS):
        return "append"
    if any(keyword in low for keyword in SKIP_KEYWORDS):
        return "skip"
    return None


def _apply_replace(draft: Dict[str, Any], field: str, proposed: Any) -> None:
    draft[field] = proposed


def _apply_append(draft: Dict[str, Any], field: str, proposed: Any, append_candidates: Any) -> None:
    if field not in LIST_FIELDS:
        _apply_replace(draft, field, proposed)
        return

    current_list = ensure_list(draft.get(field) or [])
    append_list = ensure_list(append_candidates or proposed)
    for item in append_list:
        if item not in current_list:
            current_list.append(item)
    draft[field] = current_list


async def edit_choice(state: SessionState) -> SessionState:
    text = last_user_text(state) or ""
    action = _detect_action(text)

    pending = deepcopy(state.get("pending_edit") or {})
    items = pending.get("items") or []
    index = pending.get("index", 0)

    if not items or index >= len(items):
        log_state(state, "edit_choice:no_item", text=text)
        return {
            "pending_edit": {},
            "_intent": "collect",
            "edit_choice_retry": False,
        }

    item = items[index]
    field = item.get("field")
    label = item.get("label") or FIELD_LABELS.get(field, field)
    suggested_action = item.get("action") or "replace"

    if action is None:
        if any(keyword in text for keyword in CONFIRM_KEYWORDS):
            action = suggested_action
        else:
            hint = ACTION_LABEL.get(suggested_action, "수정")
            message = (
                f"'{label}' 항목을 어떻게 처리할지 이해하지 못했습니다.\n"
                "다시 한 번 알려주세요. '수정', '추가', '건너뛰기' 중 하나로 답하시면 됩니다.\n"
                f"(추천 선택: '{hint}')"
            )
            log_state(state, "edit_choice:retry", user=text, item=item)
            pending["status"] = "awaiting_choice"
            return {
                "pending_edit": pending,
                "_intent": "edit_choice",
                "snapshot_text": message,
                "edit_choice_retry": True,
            }

    if action is None:
        message = (
            f"'{label}' 항목을 어떻게 처리할지 이해하지 못했습니다.\n"
            "다시 한 번 알려주세요. '수정', '추가', '건너뛰기' 중 하나로 답하시면 됩니다."
        )
        log_state(state, "edit_choice:retry", user=text, item=item)
        pending["status"] = "awaiting_choice"
        return {
            "pending_edit": pending,
            "_intent": "edit_choice",
            "snapshot_text": message,
            "edit_choice_retry": True,
        }

    draft = deepcopy(state.get("brand_draft") or {})
    applied_message = ""

    if action == "skip":
        applied_message = f"'{label}' 변경을 건너뛰었어요."
    elif action == "append":
        _apply_append(draft, field, item.get("proposed"), item.get("append_candidates"))
        new_value = format_value(draft.get(field))
        applied_message = f"'{label}'에 새 값을 추가했어요: {new_value}"
    else:  # replace
        _apply_replace(draft, field, item.get("proposed"))
        new_value = format_value(draft.get(field))
        applied_message = f"'{label}' 값을 {new_value} 로 수정했어요."

    # 다음 항목 준비
    items = pending.get("items") or []
    index += 1
    if index < len(items):
        pending["index"] = index
        pending["status"] = "pending_confirm"
        next_intent = "edit_confirm"
    else:
        pending = {}
        next_intent = "collect"

    log_state(
        state,
        "edit_choice:applied",
        action=action,
        field=field,
        index=index,
        remaining=len(items) - index,
    )

    return {
        "brand_draft": draft,
        "pending_edit": pending,
        "_intent": next_intent,
        "snapshot_text": applied_message,
        "edit_choice_retry": False,
    }

