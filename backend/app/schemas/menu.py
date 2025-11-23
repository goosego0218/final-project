# 메뉴 관련 스키마
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from typing import Optional
from pydantic import BaseModel

class MenuBase(BaseModel):
    menu_id: int
    menu_nm: str
    up_menu_id: Optional[int] = None
    menu_path: str
    menu_order: Optional[int] = None
    del_yn: str = "N"

    class Config:
        from_attributes = True