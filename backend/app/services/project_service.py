# 프로젝트 관련 비즈니스 로직
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.project import ProdGroup
from app.schemas.project import ProjectGroupCreate


def create_project_group(db: Session, payload: ProjectGroupCreate) -> ProdGroup:
    """
    prod_grp 에 새로운 프로젝트 그룹 한 줄 INSERT.
    """
    obj = ProdGroup(
        grp_nm=payload.grp_nm,
        grp_desc=payload.grp_desc,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
