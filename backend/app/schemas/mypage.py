# 마이페이지 관련 스키마
# 작성일: 2025-12-05

from pydantic import BaseModel
from typing import List, Literal


class MyPageItem(BaseModel):
    """마이페이지 작품 아이템"""
    prod_id: int
    type: Literal["logo", "short"]
    file_url: str | None
    title: str | None
    likes: int
    comments: int
    created_at: str | None
    is_liked: bool


class MyPageItemsResponse(BaseModel):
    """마이페이지 작품 목록 응답"""
    items: List[MyPageItem]

