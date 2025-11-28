# 쇼츠 관련 스키마
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from pydantic import BaseModel


class SaveShortsRequest(BaseModel):
    base64_video: str  # Data URL 형식
    project_id: int
    prod_type_id: int | None = 1  # 쇼츠 타입 ID (기본값)


class SaveShortsResponse(BaseModel):
    success: bool
    message: str
    prod_id: int
    file_path: str
    file_url: str