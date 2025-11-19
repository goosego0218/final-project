# 챗봇 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.chat import ChatRequest
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)