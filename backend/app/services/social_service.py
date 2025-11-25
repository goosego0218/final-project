# 소셜 미디어 연동 서비스
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 초기 작성

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from app.models.social import SocialConnection
from app.models.auth import UserInfo


def get_social_connection(
    db: Session,
    user_id: int,
    platform: str,
) -> Optional[SocialConnection]:
    """
    특정 사용자의 특정 플랫폼 연동 정보 조회.
    - del_yn = 'N'인 것만 조회
    """
    return (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == platform,
            SocialConnection.del_yn == "N",
        )
        .first()
    )


def create_or_update_social_connection(
    db: Session,
    user_id: int,
    platform: str,
    access_token: str,
    refresh_token: Optional[str] = None,
    token_expires_at: Optional[datetime] = None,
    platform_user_id: Optional[str] = None,
    email: Optional[str] = None,
) -> SocialConnection:
    """
    소셜 미디어 연동 정보 생성 또는 업데이트.
    - 이미 연동되어 있으면 업데이트
    - 없으면 새로 생성
    """
    existing = get_social_connection(db, user_id, platform)
    
    if existing:
        # 기존 연동 정보 업데이트
        existing.access_token = access_token
        if refresh_token:
            existing.refresh_token = refresh_token
        if token_expires_at:
            existing.token_expires_at = token_expires_at
        if platform_user_id:
            existing.platform_user_id = platform_user_id
        if email:
            existing.email = email
        existing.del_yn = "N"  # 재연동 시 활성화
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 새로 생성
        connection = SocialConnection(
            user_id=user_id,
            platform=platform,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            platform_user_id=platform_user_id,
            email=email,
        )
        db.add(connection)
        db.commit()
        db.refresh(connection)
        return connection


def delete_social_connection(
    db: Session,
    user_id: int,
    platform: str,
) -> None:
    """
    소셜 미디어 연동 해제 (소프트 삭제: del_yn을 'Y'로 변경).
    """
    connection = get_social_connection(db, user_id, platform)
    if connection:
        connection.del_yn = "Y"
        db.commit()