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

bearer_scheme = APIKeyHeader(
    name="Authorization",
    auto_error=False,
)

GUEST_ROLE_ID = 3


def _extract_raw_token(token: Optional[str]) -> Optional[str]:
    """
    Authorization 헤더 문자열에서 실제 JWT 토큰만 뽑아낸다.

    - "Bearer x.y.z"  -> "x.y.z"
    - "bearer x.y.z"  -> "x.y.z"
    - "x.y.z"         -> "x.y.z"
    - None / 빈문자열 -> None
    """
    if not token:
        return None

    token = token.strip()
    if token.lower().startswith("bearer "):
        return token[7:].strip()
    return token or None


def get_optional_user(
    token: Optional[str] = Depends(bearer_scheme),
    db: Session = Depends(get_orm_session),
) -> Optional[UserInfo]:
    raw_token = _extract_raw_token(token)
    if not raw_token:
        # 토큰 없으면 비로그인
        return None

    try:
        payload = decode_access_token(raw_token)
    except Exception:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    user = db.get(UserInfo, int(user_id))
    return user

TEST_LOGIN_ID = "test"

def _get_test_user(db: Session) -> UserInfo:
    """
    개발용 헬퍼: user_info에서 login_id='test' 계정을 찾아서 반환.
    없으면 500 에러.
    """
    user = (
        db.query(UserInfo)
        .filter(UserInfo.login_id == TEST_LOGIN_ID)
        .first()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="테스트 계정 'test'가 존재하지 않습니다. 먼저 user_info에 test 계정을 생성하세요.",
        )
    return user

def get_current_user(
    token: Optional[str] = Depends(bearer_scheme),
    db: Session = Depends(get_orm_session),
) -> UserInfo:
    # raw_token = _extract_raw_token(token)
    # if not raw_token:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="인증 토큰이 필요합니다.",
    #     )

    # try:
    #     payload = decode_access_token(raw_token)
    # except Exception:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="유효하지 않은 토큰입니다.",
    #     )

    # user_id = payload.get("sub")
    # if user_id is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="유효하지 않은 토큰입니다.",
    #     )

    # user = db.get(UserInfo, int(user_id))
    # if user is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="존재하지 않는 사용자입니다.",
    #     )

    # return user
    return _get_test_user(db)
