# 채팅 API 라우터 (브랜드봇)
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성 

from __future__ import annotations
import hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.deps import get_current_user
from app.models.auth import UserInfo
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionCreateRequest,
    ChatSessionResponse,
)
from app.services.chat_service import (
    ChatService,
    ChatSessionNotFound,
    chat_service,
)

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)


def get_service() -> ChatService:
    return chat_service


# chat.py의 generate_session_id 함수 수정
def generate_session_id(user_id: int) -> str:
    """user_id + 현재 시각(초까지)을 해시하여 세션 ID 생성"""
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    raw_string = f"{user_id}_{now}"
    hash_obj = hashlib.sha256(raw_string.encode())
    return f"sess-{hash_obj.hexdigest()[:16]}"


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    payload: ChatSessionCreateRequest,
    service: ChatService = Depends(get_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ChatSessionResponse:
    """
    채팅 세션 생성 (로그인 필수)
    - 브랜드봇과의 대화 세션을 시작합니다.
    - session_id가 없으면 user_id + 현재 시각으로 새로 생성, 있으면 기존 세션 반환
    """
    if payload.session_id is None:
        session_id = generate_session_id(current_user.id)
    else:
        session_id = payload.session_id
    
    state = await service.create_session(session_id)
    return ChatSessionResponse(state=state)


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: str,
    service: ChatService = Depends(get_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ChatSessionResponse:
    """
    채팅 세션 상태 조회 (로그인 필수)
    """
    try:
        state = await service.get_session(session_id)
    except ChatSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc
    return ChatSessionResponse(state=state)


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_chat_message(
    session_id: str,
    payload: ChatMessageRequest,
    service: ChatService = Depends(get_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ChatMessageResponse:
    """
    채팅 메시지 전송 (로그인 필수)
    - 브랜드봇에게 메시지를 보냅니다.
    """
    try:
        state = await service.send_message(session_id, payload.message)
    except ChatSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc
    return ChatSessionResponse(state=state)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    service: ChatService = Depends(get_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    채팅 세션 삭제 (로그인 필수)
    - 세션을 삭제합니다. 초기화가 필요하면 삭제 후 새로 생성하세요.
    """
    try:
        await service.delete_session(session_id)
    except ChatSessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found") from exc