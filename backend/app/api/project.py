# 프로젝트 관련 API
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from fastapi import HTTPException
from app.core.deps import get_current_user
from app.db.orm import get_orm_session
from app.models.auth import UserInfo
from app.schemas.project import ProjectGrp, ProjectListItem
from app.services.project_service import create_project_group, get_user_projects, load_project_group_entity, delete_project_group

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


@router.get(
    "/groups/{project_id}",
    response_model=ProjectGrp,
)
def get_project_detail_endpoint(
    project_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트 상세 조회.
    - 현재 로그인한 사용자가 생성한 프로젝트만 조회 가능
    """
    project = load_project_group_entity(db, project_id)
    
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )
    
    # 본인이 생성한 프로젝트인지 확인
    if project.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다.",
        )
    
    # 삭제된 프로젝트인지 확인
    if project.del_yn == "Y":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )
    
    return ProjectGrp(
        grp_id=project.grp_id,
        grp_nm=project.grp_nm,
        grp_desc=project.grp_desc,
        creator_id=project.creator_id,
    )


@router.delete(
    "/groups/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_group_endpoint(
    project_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트 삭제 (소프트 삭제: del_yn을 'Y'로 변경).
    - 본인이 생성한 프로젝트만 삭제 가능
    """
    try:
        delete_project_group(db, project_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    
    return None
