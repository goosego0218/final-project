# 댓글 관련 스키마
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CommentCreateRequest(BaseModel):
    prod_id: int  # 생성물 번호 (숏폼 또는 로고)
    content: str  # 댓글 내용


class CommentUpdateRequest(BaseModel):
    content: str  # 수정할 댓글 내용


class CommentResponse(BaseModel):
    comment_id: int
    prod_id: int
    user_id: int
    user_nickname: str
    content: str
    create_dt: datetime
    update_dt: datetime
    
    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total_count: int