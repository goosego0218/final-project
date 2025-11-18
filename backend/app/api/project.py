# 프로젝트 관련 API
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.orm import get_orm_session
from app.models.auth import UserInfo
from app.schemas.project import ProjectGroupCreate, ProjectGroupResponse
from app.services.project_service import create_project_group

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)


@router.post(
    "/groups",
    response_model=ProjectGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project_group_endpoint(
    payload: ProjectGroupCreate,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트 그룹 생성 API

    - Swagger에서 테스트용으로 사용
    - body: { "grp_nm": "...", "grp_desc": "..." }
    - 현재는 생성자 정보는 따로 저장하지 않고,
      단순히 prod_grp 에 한 줄 INSERT만 진행.
    """
    group = create_project_group(db, payload)
    return group
