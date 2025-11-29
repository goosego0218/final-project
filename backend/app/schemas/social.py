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


class YouTubeUploadResponse(BaseModel):
    success: bool
    video_id: str
    video_url: str
    shorts_url: str
    message: str


class InstagramUploadRequest(BaseModel):
    video_url: str  # NCP Object Storage URL
    caption: str  # 릴스 캡션
    project_id: int  # 프로젝트 ID (브랜드 프로필 가져오기 위해)
    share_to_feed: bool = True  # 릴스+피드에 함께 올리기


class InstagramUploadResponse(BaseModel):
    success: bool
    media_id: str
    message: str