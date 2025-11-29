# 좋아요 관련 스키마
# 작성일: 2025-11-29

from pydantic import BaseModel
from datetime import datetime


class LikeToggleResponse(BaseModel):
    """좋아요 토글 응답"""
    is_liked: bool
    like_count: int


class LikeStatusResponse(BaseModel):
    """좋아요 상태 조회 응답"""
    prod_id: int
    is_liked: bool
    like_count: int

