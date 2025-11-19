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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.orm import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import ProdGroup

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

    # user_info와 1:N
    users: Mapped[list["UserInfo"]] = relationship(
        back_populates="role",
        lazy="selectin",
    )

    # role_menu와 1:N (권한별 메뉴 매핑)
    role_menus: Mapped[list["RoleMenu"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
        lazy="selectin",
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
        nullable=True,
        comment="수정일",
    )

    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("role_mst.role_id"),
        nullable=False,
        comment="권한ID",
    )

    # 권한 관계 (N:1)
    role: Mapped["Role"] = relationship(
        back_populates="users",
        lazy="joined",
    )

    # 이 유저가 생성한 프로젝트 그룹들 (1:N)
    project_groups: Mapped[list["ProdGroup"]] = relationship(
        back_populates="creator",
        cascade="all, delete-orphan",
        lazy="selectin",
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
    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        default="N",
        comment="삭제여부",
    )

    # role_menu와 1:N (이 메뉴를 쓰는 권한들)
    role_menus: Mapped[list["RoleMenu"]] = relationship(
        back_populates="menu",
        cascade="all, delete-orphan",
        lazy="selectin",
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

    # 각각 role_mst, menu 쪽과 N:1
    role: Mapped[Role] = relationship(
        back_populates="role_menus",
        lazy="joined",
    )
    menu: Mapped[Menu] = relationship(
        back_populates="role_menus",
        lazy="joined",
    )