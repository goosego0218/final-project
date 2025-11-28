# 메뉴 조회 비즈니스 로직
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from sqlalchemy.orm import Session
from app.models.auth import Menu, RoleMenu

def get_menus_by_role(db: Session, role_id: int) -> list[Menu]:
    """
    특정 role_id가 접근 가능한 메뉴 목록 조회.
    - role_menu 조인
    - 삭제되지 않은 메뉴(del_yn = 'N')만 조회
    - menu_order로 정렬
    """
    return (
        db.query(Menu)
        .join(RoleMenu, RoleMenu.menu_id == Menu.menu_id)
        .filter(
            RoleMenu.role_id == role_id,
            Menu.del_yn == "N",
        )
        .order_by(Menu.menu_order.asc().nulls_last())
        .all()
    )