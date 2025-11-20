# 브랜드/로고/숏폼 에이전트 공통 노드
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agents.state import AppState


def get_last_user_message(state: "AppState") -> str:
    messages = state.get("messages", [])
    for msg in reversed(messages):
        if hasattr(msg, 'type') and msg.type == "human":
            content = getattr(msg, 'content', '')
            if isinstance(content, str):
                return content
    return ""
