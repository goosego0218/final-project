"""Brandbot 에이전트 API 라우터."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.brandbot import (
    BrandbotMessageRequest,
    BrandbotMessageResponse,
    BrandbotSessionCreateRequest,
    BrandbotSessionResponse,
)
from app.services.brandbot_service import (
    BrandbotAgentService,
    BrandbotSessionNotFound,
    brandbot_agent_service,
)


router = APIRouter(prefix="/brandbot", tags=["Brandbot Agent"])


def get_service() -> BrandbotAgentService:
    return brandbot_agent_service


@router.post("/sessions", response_model=BrandbotSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_brandbot_session(
    payload: BrandbotSessionCreateRequest,
    service: BrandbotAgentService = Depends(get_service),
) -> BrandbotSessionResponse:
    state = await service.create_session(payload.session_id, reset=payload.reset)
    return BrandbotSessionResponse(state=state)


@router.get("/sessions/{session_id}", response_model=BrandbotSessionResponse)
async def get_brandbot_session(
    session_id: str,
    service: BrandbotAgentService = Depends(get_service),
) -> BrandbotSessionResponse:
    try:
        state = await service.get_session(session_id)
    except BrandbotSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc
    return BrandbotSessionResponse(state=state)


@router.post("/sessions/{session_id}/messages", response_model=BrandbotMessageResponse)
async def send_brandbot_message(
    session_id: str,
    payload: BrandbotMessageRequest,
    service: BrandbotAgentService = Depends(get_service),
) -> BrandbotMessageResponse:
    try:
        state = await service.send_message(session_id, payload.message)
    except BrandbotSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc
    return BrandbotSessionResponse(state=state)


@router.post("/sessions/{session_id}/reset", response_model=BrandbotSessionResponse)
async def reset_brandbot_session(
    session_id: str,
    service: BrandbotAgentService = Depends(get_service),
) -> BrandbotSessionResponse:
    try:
        state = await service.reset_session(session_id)
    except BrandbotSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc
    return BrandbotSessionResponse(state=state)

