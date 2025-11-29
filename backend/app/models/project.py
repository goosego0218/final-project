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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.orm import Base
from app.models.auth import UserInfo
from datetime import datetime
from sqlalchemy import DateTime, func
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.auth import UserInfo


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

    update_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="수정일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
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

    update_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="수정일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )


class Comment(Base):
    """
    생성물 댓글 테이블 (comments)
    """
    __tablename__ = "comments"
    
    comment_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="댓글 번호",
    )
    
    prod_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("generation_prod.prod_id"),
        nullable=False,
        comment="생성물 번호",
    )
    
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=False,
        comment="작성자 유저 번호",
    )
    
    content: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
        comment="댓글 내용",
    )
    
    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="작성일",
    )
    
    update_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        onupdate=func.sysdate(),
        nullable=False,
        comment="수정일",
    )
    
    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )


class GenerationLike(Base):
    """
    유저별 생성물 좋아요 테이블 (generation_like)
    - 복합 PK: (prod_id, user_id)
    - 트리거로 generation_prod.like_cnt 자동 업데이트
    """
    __tablename__ = "generation_like"
    
    prod_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("generation_prod.prod_id"),
        primary_key=True,
        nullable=False,
        comment="생성물 번호",
    )
    
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        primary_key=True,
        nullable=False,
        comment="유저 번호",
    )
    
    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="좋아요 일시",
    )