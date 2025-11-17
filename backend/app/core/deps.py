# 공통 의존성(비로그인, 로그인 선택적)
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.orm import get_orm_session
from app.models.auth import UserInfo

# Authorization 헤더에서 토큰 가져오기
bearer_scheme = APIKeyHeader(
    name="Authorization",
    auto_error=False,   # 토큰 없어도 에러 안 냄
)

GUEST_ROLE_ID = 3

def get_optional_user(
    token: Optional[str] = Depends(bearer_scheme),
    db: Session = Depends(get_orm_session),
) -> Optional[UserInfo]:
    # 토큰 없으면 비로그인
    if not token:
        return None

    raw_token = token.strip()

    try:
        payload = decode_access_token(raw_token)
    except Exception:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    user = db.get(UserInfo, int(user_id))
    return user


def get_current_user(
    token: Optional[str] = Depends(bearer_scheme),
    db: Session = Depends(get_orm_session),
) -> UserInfo:

    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다.",
        )

    raw_token = token.strip()

    try:
        payload = decode_access_token(raw_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
        )

    user = db.get(UserInfo, int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="존재하지 않는 사용자입니다.",
        )

    return user