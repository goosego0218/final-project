# 프로젝트 관련 스키마
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    """프로젝트 생성 요청"""
    grp_name: str = Field(..., description="프로젝트 그룹명")
    grp_desc: Optional[str] = Field(None, description="프로젝트 내용/설명")


class ProjectResponse(BaseModel):
    """프로젝트 응답"""
    grp_id: int
    grp_name: str
    grp_desc: Optional[str] = None
    create_dt: datetime

    class Config:
        from_attributes = True