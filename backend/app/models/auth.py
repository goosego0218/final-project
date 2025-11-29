# 권한/유저 ORM 모델
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.orm import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING: # 타입 검사할 때만 실행하고, 실제 파이썬을 실행할 때는 실행되지 않음.
    from app.models.project import ProdGroup, GenerationProd, Comment
    from app.models.social import SocialConnection

class Role(Base):
    """
    권한 마스터 테이블 (role_mst)
    """
    __tablename__ = "role_mst"

    role_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="권한ID",
    )
    role_nm: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="권한명",
    )
    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        default="N",
        comment="삭제여부",
    )


class UserInfo(Base):
    """
    유저 정보 테이블 (user_info)
    - id는 NUMBER, 시퀀스+트리거로 자동 증가
    """
    __tablename__ = "user_info"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="유저번호",
    )
    login_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        comment="아이디",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="비밀번호",
    )
    nickname: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="닉네임",
    )
    status: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        default="Y",
        comment="상태",
    )

    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="생성일",
    )
    update_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        onupdate=func.sysdate(),
        nullable=False,  # NOT NULL로 변경
        comment="수정일",
    )

    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("role_mst.role_id"),
        nullable=False,
        comment="권한ID",
    )

class Menu(Base):
    """
    메뉴 테이블 (menu)
    """
    __tablename__ = "menu"

    menu_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="메뉴ID",
    )
    menu_nm: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="메뉴명",
    )
    up_menu_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="상위메뉴ID",
    )
    menu_path: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="메뉴경로",
    )
    menu_order: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="메뉴순서",
    )
    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        default="N",
        comment="삭제여부",
    )


class RoleMenu(Base):
    """
    권한별 메뉴 매핑 테이블 (role_menu)
    - role_id + menu_id 복합 PK
    """
    __tablename__ = "role_menu"

    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("role_mst.role_id"),
        primary_key=True,
        comment="권한ID",
    )
    menu_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("menu.menu_id"),
        primary_key=True,
        comment="메뉴ID",
    )