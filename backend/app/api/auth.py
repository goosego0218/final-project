# Auth API 라우터
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.orm import get_orm_session
from app.schemas.auth import UserCreate, UserLogin, UserBase, Token
from app.services.auth_service import create_user, authenticate_user
from app.core.security import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

@router.post("/signup", response_model=UserBase)
def signup(
    user_in: UserCreate,
    db: Session = Depends(get_orm_session),
):
    """
    회원가입 엔드포인트
    """
    user = create_user(db, user_in)
    return user

@router.post("/login", response_model=Token)
def login(
    login_in: UserLogin,
    db: Session = Depends(get_orm_session)
):
    """
    로그인 엔드포인트
    - JWT access_token 반환
    """
    user = authenticate_user(db, login_in.login_id, login_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="아이디 또는 비밀번호가 잘못되었습니다.",
        )
    
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role_id": user.role_id,
        }
    )

    return Token(access_token=access_token)
