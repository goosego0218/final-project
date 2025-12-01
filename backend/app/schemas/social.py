# 소셜 미디어 관련 스키마
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from pydantic import BaseModel
from typing import Optional, List


class YouTubeUploadRequest(BaseModel):
    video_url: str  # NCP Object Storage URL
    title: str
    project_id: int  # 프로젝트 ID (브랜드 프로필 가져오기 위해)
    description: Optional[str] = ""  # 사용 안 함 (백엔드에서 자동 생성)
    tags: Optional[List[str]] = []
    privacy: str = "public"
    prod_id: Optional[int] = None  # 생성물 ID (선택적, 없으면 video_url로 찾음)


class YouTubeUploadResponse(BaseModel):
    success: bool
    video_id: str
    video_url: str
    shorts_url: str
    message: str


class TikTokUploadRequest(BaseModel):
    video_url: str      # NCP Object Storage URL
    caption: str        # 틱톡 캡션
    project_id: int     # 브랜드 프로필 불러오기 용


class TikTokUploadResponse(BaseModel):
    success: bool
    publish_id: str | None
    message: str
