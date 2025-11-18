# 프로젝트 관련 비즈니스 로직
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from sqlalchemy.orm import Session

from app.models.project import ProdGroup
from app.schemas.project import ProjectGRP


def create_project_group(
    db: Session,
    payload: ProjectGRP,
    creator_id: int,
) -> ProdGroup:
    """
    prod_grp 에 새로운 프로젝트 그룹 한 줄 INSERT.
    creator_id 는 항상 로그인한 사용자 ID 로 세팅.
    """
    obj = ProdGroup(
        grp_nm=payload.grp_nm,
        grp_desc=payload.grp_desc,
        creator_id=creator_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
