# 갤러리 관련 스키마
# 작성일: 2025-12-XX
# 수정내역
# - 2025-12-XX: 초기 작성

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GalleryItemResponse(BaseModel):
    """갤러리 아이템 응답"""
    prod_id: int
    file_url: str
    like_count: int
    comment_count: int
    create_dt: datetime
    # 추가 정보 (필요시)
    brand_name: Optional[str] = None
    tags: Optional[list[str]] = None


class GalleryListResponse(BaseModel):
    """갤러리 목록 응답"""
    items: list[GalleryItemResponse]
    total_count: int
    skip: int
    limit: int

