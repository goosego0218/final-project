# 메뉴 조회 비즈니스 로직
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성
# - 2025-12-XX: 성능 최적화 - 불필요한 relationship 로딩 방지

from sqlalchemy.orm import Session, noload
from app.models.auth import Menu, RoleMenu

def get_menus_by_role(db: Session, role_id: int) -> list[Menu]:
    """
    특정 role_id가 접근 가능한 메뉴 목록 조회.
    - role_menu 조인
    - 삭제되지 않은 메뉴(del_yn = 'N')만 조회
    - menu_order로 정렬
    - 성능 최적화: role_menus relationship 로딩 방지
    """
    return (
        db.query(Menu)
        .join(RoleMenu, RoleMenu.menu_id == Menu.menu_id)
        .options(noload(Menu.role_menus))  # 불필요한 relationship 로딩 방지
        .filter(
            RoleMenu.role_id == role_id,
            Menu.del_yn == "N",
        )
        .order_by(Menu.menu_order.asc().nulls_last())
        .all()
    )