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

class Role(Base):
    """
    권한 테이블 (role_mst)
    - role_id: PK
    - role_nm: 권한명
    - del_yn: 삭제 여부 (기본값 'N')
    """
    __tablename__ = "role_mst"

    role_id: Mapped[str] = mapped_column(
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

    # user_info와 1:N 관계
    users: Mapped[list["UserInfo"]] = relationship(
        back_populates="role",
        lazy="selectin",
    )

class UserInfo(Base):
    """
    유저 정보 테이블 (user_info)
    - id: PK (NUMBER, 시퀀스로 1씩 증가한다고 가정)
    - login_id: 아이디 (unique)
    - password_hash: 비밀번호 해시
    - nickname: 닉네임
    - status: 상태 (Y/N)
    - create_dt / update_dt: 생성/수정일 (sysdate)
    - role_id: Role.role_id FK (NUMBER)
    """
    __tablename__ = "user_info"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
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

    role: Mapped[Role] = relationship(
        back_populates="users",
        lazy="joined",
    )

class Menu(Base):
    """
    메뉴 테이블 (menu)
    - menu_id: PK (NUMBER)
    - menu_nm: 메뉴명
    - up_menu_id: 상위 메뉴 ID (루트 메뉴면 NULL)
    - menu_path: 메뉴 경로 (URL, 라우트 등)
    - del_yn: 삭제 여부 (기본값 'N')
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

    role_menus: Mapped[list["RoleMenu"]] = relationship(
        back_populates="menu",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    roles: Mapped[list["Role"]] = relationship(
        secondary="role_menu",
        back_populates="menus",
        lazy="selectin",
    )

class RoleMenu(Base):
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

    role: Mapped[Role] = relationship(
        back_populates="role_menus",
        lazy="joined",
    )
    menu: Mapped[Menu] = relationship(
        back_populates="role_menus",
        lazy="joined",
    )