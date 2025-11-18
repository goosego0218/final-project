# 프로젝트 관련 API
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.orm import get_orm_session
from app.models.auth import UserInfo
from app.schemas.project import ProjectGrp
from app.services.project_service import create_project_group

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)


@router.post(
    "/groups",
    response_model=ProjectGrp,   # create / response 둘 다 ProjectGRP 사용
    status_code=status.HTTP_201_CREATED,
)
def create_project_group_endpoint(
    payload: ProjectGrp,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트 그룹 생성 API

    - body: { "grp_nm": "...", "grp_desc": "..." } 만 보내면 됨
    - grp_id / creator_id 는 서버에서 채워서 응답으로 내려줌
    """
    group = create_project_group(
        db=db,
        payload=payload,
        creator_id=current_user.id,
    )

    # 응답에 creator_id 도 찍어주기
    return ProjectGrp(
        grp_id=group.grp_id,
        grp_nm=group.grp_nm,
        grp_desc=group.grp_desc,
        creator_id=group.creator_id,
    )
