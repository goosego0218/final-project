from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.auth import UserInfo
from app.schemas.auth import UserCreate
from app.core.security import get_password_hash, verify_password

def get_user_by_login_id(db: Session, login_id: str) -> Optional[UserInfo]:
    """
    login_id로 유저 한 명 조회.
    """
    return (
        db.query(UserInfo)
        .filter(UserInfo.login_id == login_id)
        .first()
    )

def create_user(db: Session, user_in: UserCreate) -> UserInfo:
    """
    회원가입 처리.
    - login_id 중복 여부 체크
    - 비밀번호 해시 처리 후 저장
    """
    # 1) 아이디 중복 체크
    existing = get_user_by_login_id(db, user_in.login_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다.",
        )

    # 2) 비밀번호 해싱
    hashed_pw = get_password_hash(user_in.password)

    # 3) UserInfo 엔티티 생성
    user = UserInfo(
        login_id=user_in.login_id,
        password_hash=hashed_pw,
        nickname=user_in.nickname,
        role_id=2, # 강제로 일반 유저로 회원가입 -> 0(SYSTEM), 1(ADMIN)
    )

    # 4) DB 반영
    db.add(user)
    db.commit()
    # refresh 제거: commit 후 이미 user 객체에 id 등이 설정되어 있음
    # 불필요한 relationship 로딩 방지

    return user

def authenticate_user(db: Session, login_id: str, password: str) -> Optional[UserInfo]:
    """
    로그인 처리.
    - login_id로 유저 조회
    - 비밀번호 검증
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    # 필요하면 여기서 status 체크 (예: 탈퇴 계정 등)
    # if user.status != "Y": ...

    return user