# 소셜 미디어 관련 스키마
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from pydantic import BaseModel
from typing import Optional, List


class YouTubeUploadRequest(BaseModel):
    video_url: str  # NCP Object Storage URL
    title: str
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    privacy: str = "public"


class YouTubeUploadResponse(BaseModel):
    success: bool
    video_id: str
    video_url: str
    shorts_url: str
    message: str