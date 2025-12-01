# 소셜 미디어 연동 모델
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 최초 작성
# - 2025-12-XX: OAuthIdentity, SocialPost, SocialPostMetric 추가

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, ForeignKey, DateTime, text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.orm import Base

if TYPE_CHECKING: # 타입 검사할 때만 실행하고, 실제 파이썬을 실행할 때는 실행되지 않음.
    from app.models.auth import UserInfo
    from app.models.project import GenerationProd


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
        comment="플랫폼 (youtube, tiktok)",
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


class OAuthIdentity(Base):
    """
    OAuth 인증 정보 테이블 (oauth_identity)
    - 구글 로그인 정보 저장
    """
    __tablename__ = "oauth_identity"

    oauth_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="OAuth 인증 ID",
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_info.id"),
        nullable=False,
        comment="유저번호",
    )

    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="제공자 (google)",
    )

    provider_user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="제공자 사용자 ID (Google sub)",
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="구글 이메일",
    )

    create_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("SYSDATE"),
        nullable=False,
        comment="생성일",
    )

    update_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("SYSDATE"),
        onupdate=text("SYSDATE"),
        nullable=False,
        comment="수정일",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    __table_args__ = (
        CheckConstraint("provider IN ('google')", name="ck_oauth_identity_provider"),
    )


class SocialPost(Base):
    """
    소셜 미디어 게시물 테이블 (social_post)
    - 유튜브, 틱톡 업로드 기록 저장
    """
    __tablename__ = "social_post"

    post_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="게시물 ID",
    )

    prod_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("generation_prod.prod_id"),
        nullable=False,
        comment="생성물 번호",
    )

    conn_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("social_connection.conn_id"),
        nullable=False,
        comment="연동 계정 ID",
    )

    platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="플랫폼 (youtube, tiktok)",
    )

    platform_post_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="플랫폼 게시물 ID (YouTube videoId, TikTok publishId)",
    )

    platform_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="플랫폼 게시물 URL",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'PENDING'"),
        comment="업로드 상태 (PENDING/SUCCESS/FAIL/DELETED)",
    )

    error_code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="실패 시 에러 코드",
    )

    error_message: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="실패 시 에러 메시지",
    )

    requested_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("SYSDATE"),
        nullable=False,
        comment="업로드 요청 시각",
    )

    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="실제 업로드 완료 시각",
    )

    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="마지막 로그/통계 조회 시각",
    )

    del_yn: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
        server_default=text("'N'"),
        comment="삭제여부",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'SUCCESS', 'FAIL', 'DELETED')",
            name="ck_social_post_status"
        ),
    )


class SocialPostMetric(Base):
    """
    소셜 미디어 게시물 메트릭 테이블 (social_post_metric)
    - 업로드된 쇼츠영상 로그 수집
    """
    __tablename__ = "social_post_metric"

    metric_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="메트릭 ID",
    )

    post_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("social_post.post_id"),
        nullable=False,
        comment="게시물 ID",
    )

    captured_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("SYSDATE"),
        nullable=False,
        comment="수집 시각",
    )

    view_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="조회수",
    )

    like_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="좋아요수",
    )

    comment_cnt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="댓글수",
    )

    share_cnt: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="공유수 (플랫폼별로 다르므로 NULL 허용)",
    )