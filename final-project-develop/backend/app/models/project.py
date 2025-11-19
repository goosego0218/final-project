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

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    # 여기서 UserInfo 쪽 project_groups 와 연결
    creator: Mapped["UserInfo"] = relationship(
        back_populates="project_groups",
        lazy="joined",
    )

    brand_info = relationship(
        "BrandInfo",
        back_populates="group",
        uselist=False,
    )