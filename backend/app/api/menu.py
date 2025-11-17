# app/api/menu.py
# 메뉴 관련 API
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.orm import get_orm_session
from app.schemas.menu import MenuBase
from app.services.menu_service import get_menus_by_role
from app.core.deps import get_optional_user, GUEST_ROLE_ID
from app.models.auth import UserInfo     

router = APIRouter(
    prefix="/menus",
    tags=["menu"],
)

@router.get("", response_model=List[MenuBase])
def get_menus(
    db: Session = Depends(get_orm_session),
    current_user: Optional[UserInfo] = Depends(get_optional_user),
):
    """
    권한별 메뉴 목록 조회 (로그인 여부 자동 인식)
    - 비로그인: role_id = 3 (게스트)
    - 로그인: 현재 유저의 role_id
    """
    if current_user is None:
        # 비로그인 유저 → 게스트 권한
        role_id = GUEST_ROLE_ID
    else:
        # 로그인 유저 → 본인의 role_id
        role_id = current_user.role_id

    menus = get_menus_by_role(db, role_id)
    return menus
