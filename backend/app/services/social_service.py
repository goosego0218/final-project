# 소셜 미디어 연동 서비스
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 초기 작성
# - 2025-12-XX: 토큰 암호화/복호화 추가

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from app.models.social import SocialConnection
from app.models.auth import UserInfo
from app.utils.encryption import encrypt_token, decrypt_token


def get_social_connection(
    db: Session,
    user_id: int,
    platform: str,
) -> Optional[SocialConnection]:
    """
    특정 사용자의 특정 플랫폼 연동 정보 조회.
    - del_yn = 'N'인 것만 조회
    - 토큰은 복호화되어 반환됨
    """
    connection = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == platform,
            SocialConnection.del_yn == "N",
        )
        .first()
    )
    
    if connection:
        # 복호화된 토큰으로 임시 교체 (DB에는 암호화된 상태로 유지)
        connection.access_token = decrypt_token(connection.access_token)
        if connection.refresh_token:
            connection.refresh_token = decrypt_token(connection.refresh_token)
    
    return connection


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
    - 토큰은 암호화하여 저장
    """
    # 토큰 암호화
    encrypted_access_token = encrypt_token(access_token)
    encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None
    
    # 기존 연동 정보 조회 (복호화 없이 직접 조회)
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == platform,
            SocialConnection.del_yn == "N",
        )
        .first()
    )
    
    if existing:
        # 기존 연동 정보 업데이트 (암호화된 토큰 저장)
        existing.access_token = encrypted_access_token
        if encrypted_refresh_token:
            existing.refresh_token = encrypted_refresh_token
        if token_expires_at:
            existing.token_expires_at = token_expires_at
        if platform_user_id:
            existing.platform_user_id = platform_user_id
        if email:
            existing.email = email
        existing.del_yn = "N"  # 재연동 시 활성화
        db.commit()
        db.refresh(existing)
        
        # 반환 시 복호화된 토큰으로 교체
        existing.access_token = access_token
        if existing.refresh_token:
            existing.refresh_token = refresh_token or ""
        return existing
    else:
        # 새로 생성 (암호화된 토큰 저장)
        connection = SocialConnection(
            user_id=user_id,
            platform=platform,
            access_token=encrypted_access_token,
            refresh_token=encrypted_refresh_token,
            token_expires_at=token_expires_at,
            platform_user_id=platform_user_id,
            email=email,
        )
        db.add(connection)
        db.commit()
        db.refresh(connection)
        
        # 반환 시 복호화된 토큰으로 교체
        connection.access_token = access_token
        if connection.refresh_token:
            connection.refresh_token = refresh_token or ""
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