# auth 관련 스키마 정의
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from pydantic import BaseModel, Field

# 공통 유저 정보 (응답용)
class UserBase(BaseModel):
    """API 응답에 사용할 기본 유저 정보"""
    id: int
    login_id: str
    nickname: str
    status: str = "Y"
    role_id: int

    class Config:
        from_attributes = True  # ORM 객체에서 바로 변환 가능

# 회원가입 요청용
class UserCreate(BaseModel):
    """
    회원가입 시 필요한 필드
    - role_id는 기본 1번 같은 걸로 고정하고 싶으면 기본값으로 설정
    """
    login_id: str = Field(..., description="로그인 아이디")
    password: str = Field(..., description="평문 비밀번호")
    nickname: str = Field(..., description="닉네임")
    role_id: int | None = Field(
        default=None,
        description="권한 ID",
    )

# 로그인 요청용
class UserLogin(BaseModel):
    login_id: str
    password: str

# 로그인 응답용(JWT)
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
