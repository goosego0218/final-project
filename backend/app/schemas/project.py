# 프로젝트 관련 스키마
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from pydantic import BaseModel


class ProjectGroupCreate(BaseModel):
    grp_nm: str
    grp_desc: str | None = None


class ProjectGroupResponse(BaseModel):
    grp_id: int
    grp_nm: str
    grp_desc: str | None = None

    class Config:
        from_attributes = True  # ORM 객체 → 자동 변환
