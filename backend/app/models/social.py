# 소셜 미디어 연동 모델
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 최초 작성

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, ForeignKey, DateTime, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.orm import Base

if TYPE_CHECKING: # 타입 검사할 때만 실행하고, 실제 파이썬을 실행할 때는 실행되지 않음.
    from app.models.auth import UserInfo


class SocialConnection(Base):
    """
    소셜 미디어 연동 테이블 (social_connection)
    """
    __tablename__ = "social_connection"

    conn_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="연동ID",
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=False,
        comment="유저번호",
    )

    platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="플랫폼 (youtube, instagram)",
    )

    platform_user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="플랫폼 사용자 ID (YouTube 채널 ID 등)",
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="연동된 이메일",
    )

    access_token: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
        comment="액세스 토큰 (암호화 저장)",
    )

    refresh_token: Mapped[str | None] = mapped_column(
        String(2000),
        nullable=True,
        comment="리프레시 토큰 (암호화 저장)",
    )

    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="토큰 만료 시간",
    )

    connected_at: Mapped[datetime] = mapped_column(
        DateTime,
        # 오라클: DEFAULT SYSDATE
        server_default=text("SYSDATE"),
        nullable=False,
        comment="연동일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    # UserInfo와의 관계
    user: Mapped["UserInfo"] = relationship(
        back_populates="social_connections",
        lazy="select",
    )