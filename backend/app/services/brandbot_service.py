"""Brandbot 에이전트 서비스 계층.

FastAPI 라우터에서 사용할 수 있도록 Brandbot LangGraph 에이전트를
세션 단위로 관리한다. `brandbot` 패키지는 `app/agents` 하위에 벤더링되어
있으며, 이 서비스는 해당 그래프를 로드해 콘솔 러너를 재사용한다.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from langchain_core.messages import messages_to_dict

# brandbot 패키지가 app/agents 하위에 위치하므로 런타임에 sys.path에 등록한다.
_AGENTS_DIR = Path(__file__).resolve().parents[1] / "agents"
if str(_AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(_AGENTS_DIR))

from brandbot.graph.builder import build_graph
from brandbot.runner.console import ConsoleRunner
from brandbot.state import SessionState


class BrandbotSessionNotFound(Exception):
    """존재하지 않는 세션 접근 시 사용."""


@dataclass(slots=True)
class _SessionBundle:
    runner: ConsoleRunner
    lock: asyncio.Lock


class BrandbotAgentService:
    """Brandbot LangGraph 세션을 관리하는 서비스."""

    def __init__(self) -> None:
        self._graph = build_graph()
        self._sessions: dict[str, _SessionBundle] = {}
        self._sessions_lock = asyncio.Lock()

    async def create_session(self, session_id: Optional[str] = None, *, reset: bool = False) -> Dict[str, Any]:
        """세션을 생성하거나 재설정 후 스냅샷을 반환한다."""

        if session_id is None:
            session_id = self._generate_session_id()

        async with self._sessions_lock:
            bundle = self._sessions.get(session_id)
            if bundle is None or reset:
                bundle = self._new_session_bundle(session_id)
                self._sessions[session_id] = bundle

        return self._serialize_state(session_id, bundle.runner.state)

    async def get_session(self, session_id: str) -> Dict[str, Any]:
        bundle = self._sessions.get(session_id)
        if bundle is None:
            raise BrandbotSessionNotFound(session_id)
        return self._serialize_state(session_id, bundle.runner.state)

    async def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        bundle = self._sessions.get(session_id)
        if bundle is None:
            raise BrandbotSessionNotFound(session_id)

        async with bundle.lock:
            state = await bundle.runner.step(message)
        return self._serialize_state(session_id, state)

    async def reset_session(self, session_id: str) -> Dict[str, Any]:
        """기존 세션을 초기 상태로 재설정한다."""

        async with self._sessions_lock:
            bundle = self._sessions.get(session_id)
            if bundle is None:
                raise BrandbotSessionNotFound(session_id)
            bundle = self._new_session_bundle(session_id)
            self._sessions[session_id] = bundle

        return self._serialize_state(session_id, bundle.runner.state)

    def _new_session_bundle(self, session_id: str) -> _SessionBundle:
        runner = ConsoleRunner(self._graph, thread_id=session_id)
        runner.state["session_id"] = session_id
        runner.state["vector_namespace"] = session_id
        return _SessionBundle(runner=runner, lock=asyncio.Lock())

    def _serialize_state(self, session_id: str, state: SessionState) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "session_id": session_id,
            "intent": state.get("_intent"),
            "snapshot_text": state.get("snapshot_text"),
            "brand_draft": state.get("brand_draft", {}),
            "brand_profile": state.get("brand_profile", {}),
            "brand_strategy": state.get("brand_strategy", {}),
            "trend_recos": state.get("trend_recos", {}),
            "confirmed": bool(state.get("confirmed")),
            "project_id": state.get("project_id"),
            "created_at": state.get("created_at"),
            "updated_at": state.get("updated_at"),
        }

        messages = state.get("messages") or []
        try:
            payload["messages"] = messages_to_dict(messages)
        except Exception:
            payload["messages"] = []

        return payload

    @staticmethod
    def _generate_session_id() -> str:
        return "sess-" + uuid.uuid4().hex


# 싱글톤 서비스 인스턴스 (FastAPI 디펜던시로 재사용)
brandbot_agent_service = BrandbotAgentService()

