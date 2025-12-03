# 로고 관련 스키마
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from pydantic import BaseModel


class SaveLogoRequest(BaseModel):
    base64_image: str  # Data URL 형식
    project_id: int
    prod_type_id: int | None = 1  # 로고 타입 ID (기본값)

class SaveLogoResponse(BaseModel):
    success: bool
    message: str
    prod_id: int
    file_path: str
    file_url: str

class LogoListItemResponse(BaseModel):
    prod_id: int
    file_path: str
    file_url: str
    create_dt: str | None = None
    pub_yn: str | None = None  # 공개 여부 추가

class UpdateLogoPubYnRequest(BaseModel):
    pub_yn: str  # 'Y' 또는 'N'

class UpdateLogoPubYnResponse(BaseModel):
    success: bool
    message: str
    prod_id: int
    pub_yn: str