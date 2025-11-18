# 프로젝트 그룹 모델
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.orm import Base


class ProdGrp(Base):
    """
    생성물 프로젝트 그룹 테이블 (prod_grp)
    - 브랜드봇 세션이 완료되면 이 테이블에 프로젝트로 저장됨
    """
    __tablename__ = "prod_grp"

    grp_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="그룹ID",
    )
    grp_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="그룹명",
    )
    grp_desc: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="그룹 설명",
    )
    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.sysdate(),
        nullable=False,
        comment="생성일",
    )
    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        default="N",
        comment="삭제여부",
    )