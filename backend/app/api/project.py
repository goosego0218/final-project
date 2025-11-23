# 프로젝트 관련 API
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.orm import get_orm_session
from app.models.auth import UserInfo
from app.schemas.project import ProjectGrp, ProjectListItem
from app.services.project_service import create_project_group, get_user_projects

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


@router.get(
    "/groups",
    response_model=List[ProjectListItem],
)
def get_user_projects_endpoint(
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    현재 로그인한 사용자의 프로젝트 목록 조회.
    - 로고/숏폼 개수는 현재 0으로 반환 (나중에 generation_prod 조인하여 추가 가능)
    """
    projects = get_user_projects(db, current_user.id)
    
    # ProjectListItem으로 변환 (로고/숏폼 개수는 추후 추가)
    result = []
    for project in projects:
        result.append(ProjectListItem(
            grp_id=project.grp_id,
            grp_nm=project.grp_nm,
            grp_desc=project.grp_desc,
            creator_id=project.creator_id,
            logo_count=0,  # TODO: generation_prod에서 조회
            shortform_count=0,  # TODO: generation_prod에서 조회
        ))
    
    return result
