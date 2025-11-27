# 프로젝트 관련 모델
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from __future__ import annotations

from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.orm import Base
from app.models.auth import UserInfo
from datetime import datetime
from sqlalchemy import DateTime, func


class ProdGroup(Base):
    """
    생성물 프로젝트 그룹 테이블 (prod_grp)

    - grp_id      : 프로젝트 그룹 ID (PK)
    - grp_nm      : 그룹명 (사용자가 입력)
    - grp_desc    : 그룹 설명
    - creator_id  : 생성자 유저번호 (user_info.id)
    - del_yn      : 삭제 여부 (기본 'N')
    """
    __tablename__ = "prod_grp"

    grp_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="프로젝트 그룹 ID",
    )
    grp_nm: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="프로젝트 그룹명",
    )
    grp_desc: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="프로젝트 설명",
    )

    creator_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=False,
        comment="생성자 유저번호",
    )

    updater_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=True,
        comment="수정자 유저번호",
    )

    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="생성일",
    )

    update_dt: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="수정일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    # 여기서 UserInfo 쪽 project_groups 와 연결
    creator: Mapped["UserInfo"] = relationship(
        foreign_keys=[creator_id],
        back_populates="project_groups",
        lazy="joined",
    )

    brand_info = relationship(
        "BrandInfo",
        back_populates="group",
        uselist=False,
    )


class ProdType(Base):
    """
    생성물 타입 테이블 (prod_type)
    """
    __tablename__ = "prod_type"

    type_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="타입번호",
    )

    type_nm: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="타입명",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )


class GenerationProd(Base):
    """
    생성물 테이블 (generation_prod)
    """
    __tablename__ = "generation_prod"

    prod_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="결과물 번호",
    )

    type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("prod_type.type_id"),
        nullable=False,
        comment="타입번호",
    )

    grp_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("prod_grp.grp_id"),
        nullable=False,
        comment="그룹번호",
    )

    file_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
        comment="파일경로",
    )

    view_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="조회수",
    )

    ref_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="참조수",
    )

    like_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="좋아요수",
    )

    pub_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'Y'"),
        comment="공개여부",
    )

    create_user: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=False,
        comment="생성자",
    )

    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="생성일",
    )

    update_user: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=True,
        comment="수정자",
    )

    update_dt: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="수정일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    # 관계 설정
    type: Mapped["ProdType"] = relationship(
        lazy="joined",
    )

    group: Mapped["ProdGroup"] = relationship(
        lazy="joined",
    )

    creator: Mapped["UserInfo"] = relationship(
        foreign_keys=[create_user],
        lazy="joined",
    )

    updater: Mapped["UserInfo | None"] = relationship(
        foreign_keys=[update_user],
        lazy="joined",
    )