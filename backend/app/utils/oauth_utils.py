# OAuth 토큰 관리 유틸리티
# 작성자: 황민준
# 작성일: 2025-11-25
# 수정내역
# - 2025-11-25: 초기 작성

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from app.services.social_service import get_social_connection, create_or_update_social_connection
from app.core.config import settings

try:
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False


def get_valid_youtube_credentials(
    db: Session,
    user_id: int,
) -> Tuple[Optional[Credentials], Optional[str]]:
    """
    YouTube API 사용을 위한 유효한 Credentials 반환.
    - access_token이 만료되었으면 refresh_token으로 자동 갱신
    - 만료되지 않았으면 기존 access_token 사용
    - 갱신된 토큰은 DB에 자동 저장
    
    Args:
        db: SQLAlchemy 세션
        user_id: 사용자 ID
    
    Returns:
        (Credentials 객체, error_message)
        - 성공: (Credentials 객체, None)
        - 실패: (None, 에러 메시지)
    """
    if not GOOGLE_AVAILABLE:
        return None, "Google OAuth 라이브러리가 설치되지 않았습니다."
    
    connection = get_social_connection(db, user_id, 'youtube')
    
    if not connection:
        return None, "YouTube 연동이 되어있지 않습니다."
    
    if not connection.refresh_token:
        return None, "YouTube 연동 정보가 불완전합니다. 다시 연동해주세요."
    
    kst = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst)
    
    # Credentials 객체 생성
    credentials = Credentials(
        token=connection.access_token,
        refresh_token=connection.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    
    # 토큰 만료 확인
    needs_refresh = False
    
    # 1. credentials.valid 체크 (Google 라이브러리 내부 검증)
    if not credentials.valid:
        needs_refresh = True
        print(f"[INFO] YouTube 토큰이 유효하지 않음 (credentials.valid=False) - user_id: {user_id}")
    
    # 2. DB의 token_expires_at 체크
    if connection.token_expires_at:
        expires_at = connection.token_expires_at
        if expires_at.tzinfo is None:
            # naive datetime이면 KST로 가정
            expires_at = expires_at.replace(tzinfo=kst)
        else:
            expires_at = expires_at.astimezone(kst)
        
        # 만료 시간이 5분 이내면 갱신 필요 (여유 있게)
        if expires_at <= now_kst + timedelta(minutes=5):
            needs_refresh = True
            print(f"[INFO] YouTube 토큰 만료 임박 (만료 시간: {expires_at}, 현재: {now_kst}) - user_id: {user_id}")
    
    # 토큰 갱신 시도
    if needs_refresh:
        try:
            print(f"[INFO] YouTube 토큰 갱신 시도 - user_id: {user_id}")
            credentials.refresh(Request())
            print(f"[INFO] YouTube 토큰 갱신 성공 - user_id: {user_id}")
            
            # DB에 새 토큰 저장
            token_expires_at = None
            if credentials.expiry:
                expiry = credentials.expiry
                if expiry.tzinfo is None:
                    # naive datetime이면 UTC로 가정 후 KST로 변환
                    expiry = expiry.replace(tzinfo=timezone.utc).astimezone(kst)
                else:
                    # timezone-aware면 KST로 변환
                    expiry = expiry.astimezone(kst)
                token_expires_at = expiry
                print(f"[INFO] 새 토큰 만료 시간: {token_expires_at} (KST) - user_id: {user_id}")
            
            # refresh_token도 업데이트 (새로 발급된 경우)
            new_refresh_token = credentials.refresh_token if credentials.refresh_token else connection.refresh_token
            
            create_or_update_social_connection(
                db=db,
                user_id=user_id,
                platform='youtube',
                access_token=credentials.token,
                refresh_token=new_refresh_token,
                token_expires_at=token_expires_at,
            )
            
            print(f"[SUCCESS] YouTube 토큰 DB 업데이트 완료 - user_id: {user_id}")
        except Exception as e:
            print(f"[ERROR] YouTube 토큰 갱신 실패 - user_id: {user_id}, error: {e}")
            import traceback
            traceback.print_exc()
            return None, f"토큰 갱신에 실패했습니다. 다시 연동해주세요. ({str(e)})"
    else:
        print(f"[INFO] YouTube 토큰 유효함, 기존 토큰 사용 - user_id: {user_id}")
    
    return credentials, None


def get_youtube_service(
    db: Session,
    user_id: int,
) -> Tuple[Optional[any], Optional[str]]:
    """
    YouTube API 서비스 객체 반환.
    - 토큰이 만료되었으면 자동 갱신 후 서비스 객체 반환
    
    Args:
        db: SQLAlchemy 세션
        user_id: 사용자 ID
    
    Returns:
        (YouTube service 객체, error_message)
        - 성공: (YouTube service 객체, None)
        - 실패: (None, 에러 메시지)
    """
    credentials, error = get_valid_youtube_credentials(db, user_id)
    if error:
        return None, error
    
    try:
        youtube = build('youtube', 'v3', credentials=credentials)
        return youtube, None
    except Exception as e:
        print(f"[ERROR] YouTube API 서비스 생성 실패 - user_id: {user_id}, error: {e}")
        return None, f"YouTube API 서비스 생성 실패: {str(e)}"

