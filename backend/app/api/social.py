# 소셜 미디어 연동 API
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
import json
from urllib.parse import quote

from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo
from app.core.config import settings
from app.services.social_service import (
    get_social_connection,
    create_or_update_social_connection,
    delete_social_connection,
)

try:
    from google_auth_oauthlib.flow import Flow
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

router = APIRouter(
    prefix="/social",
    tags=["social"],
)

# OAuth 2.0 스코프 (YouTube 업로드 권한)
YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload']


@router.get("/youtube/auth-url")
def get_youtube_auth_url(
    current_user: UserInfo = Depends(get_current_user),
):
    """
    YouTube OAuth 인증 URL 생성
    """
    if not GOOGLE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth 라이브러리가 설치되지 않았습니다.",
        )
    
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="YouTube 연동이 설정되지 않았습니다.",
        )
    
    # OAuth Flow 생성
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=YOUTUBE_SCOPES
    )
    flow.redirect_uri = settings.google_redirect_uri
    
    # CSRF 방지를 위한 state 생성 (user_id 포함)
    state = f"{current_user.id}:{secrets.token_urlsafe(32)}"
    
    authorization_url, _ = flow.authorization_url(
        access_type='offline',  # refresh_token 받기 위해 필수
        include_granted_scopes='true',
        prompt='consent',  # 매번 동의 화면 표시 (refresh_token 확보)
        state=state
    )
    
    return {
        "auth_url": authorization_url,
        "state": state  # 프론트엔드에서 검증용으로 사용 가능
    }


@router.get("/youtube/callback")
def youtube_oauth_callback(
    code: str = Query(None, description="Google에서 받은 authorization code"),
    state: str = Query(None, description="CSRF 방지용 state"),
    error: str = Query(None, description="Google OAuth 에러"),
    db: Session = Depends(get_orm_session),
):
    """
    OAuth 콜백 처리
    - code를 access_token, refresh_token으로 교환
    - YouTube 사용자 정보 조회
    - DB에 저장
    - 프론트엔드로 리다이렉트
    """
    # 프론트엔드 URL 가져오기 (설정에서)
    frontend_base_url = settings.frontend_url.rstrip('/')
    
    # 디버깅: 요청 파라미터 로그
    print(f"[DEBUG] YouTube OAuth Callback - code: {code is not None}, state: {state is not None}, error: {error}")
    
    if not GOOGLE_AVAILABLE:
        print("[ERROR] Google OAuth 라이브러리가 설치되지 않았습니다.")
        frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote("Google OAuth 라이브러리가 설치되지 않았습니다.")
        return RedirectResponse(url=frontend_url, status_code=302)
    
    # Google에서 에러를 반환한 경우
    if error:
        print(f"[ERROR] Google OAuth 에러: {error}")
        if error == "access_denied":
            user_message = "YouTube 연동이 취소되었습니다."
        elif "consent" in error.lower() or "verification" in error.lower():
            user_message = "YouTube 연동을 위해 Google 인증 설정이 필요합니다. 잠시 후 다시 시도해주세요."
        else:
            user_message = f"YouTube 연동 중 오류가 발생했습니다. ({error})"
        
        frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)
    
    # code가 없는 경우
    if not code or not state:
        print(f"[ERROR] code 또는 state가 없습니다. code: {code is not None}, state: {state is not None}")
        if not code:
            user_message = "인증 코드를 받을 수 없습니다. Google OAuth 동의 화면 설정을 확인해주세요."
        else:
            user_message = "인증 정보를 받을 수 없습니다."
        frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)
    
    try:
        # state에서 user_id 추출
        try:
            user_id_str, _ = state.split(":", 1)
            user_id = int(user_id_str)
        except (ValueError, IndexError):
            frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote("잘못된 요청입니다.")
            return RedirectResponse(url=frontend_url)
        
        # 사용자 확인
        user = db.get(UserInfo, user_id)
        if not user:
            frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote("사용자를 찾을 수 없습니다.")
            return RedirectResponse(url=frontend_url)
        
        # OAuth Flow 생성
        client_config = {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri]
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=YOUTUBE_SCOPES
        )
        flow.redirect_uri = settings.google_redirect_uri
        
        # Authorization code를 토큰으로 교환
        try:
            flow.fetch_token(code=code)
        except Exception as token_error:
            # 토큰 교환 실패 시 에러 타입 구분
            error_str = str(token_error).lower()
            if "consent" in error_str or "verification" in error_str or "access_denied" in error_str:
                user_message = "YouTube 연동을 위해 Google 인증 설정이 필요합니다. 잠시 후 다시 시도해주세요."
            elif "invalid_grant" in error_str:
                user_message = "인증 시간이 만료되었습니다. 다시 시도해주세요."
            else:
                user_message = "인증 처리 중 오류가 발생했습니다. 다시 시도해주세요."
            
            frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote(user_message)
            return RedirectResponse(url=frontend_url)
        
        credentials = flow.credentials
        
        access_token = credentials.token
        refresh_token = credentials.refresh_token if credentials.refresh_token else None
        
        # 토큰 만료시간 처리 (한국 시간으로 변환)
        token_expires_at = None
        if credentials.expiry:
            expiry = credentials.expiry
            
            # naive datetime인 경우 UTC로 가정
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            
            # 한국 시간대 (UTC+9)
            kst = timezone(timedelta(hours=9))
            
            # UTC를 한국 시간으로 변환
            if expiry.tzinfo == timezone.utc:
                token_expires_at = expiry.astimezone(kst)
            else:
                # 이미 다른 타임존이면 한국 시간으로 변환
                token_expires_at = expiry.astimezone(kst)
            
            # 현재 시간과 비교하여 검증
            now_kst = datetime.now(kst)
            if token_expires_at <= now_kst:
                # 만료 시간이 과거인 경우, 기본 만료 시간 추가 (1시간)
                token_expires_at = now_kst + timedelta(hours=1)
                print(f"[WARN] Token expiry is in the past, setting to 1 hour from now (KST): {token_expires_at}")
            else:
                print(f"[DEBUG] Token expires at (KST): {token_expires_at}")
        else:
            # expiry가 없는 경우 기본 만료 시간 추가 (1시간, 한국 시간)
            kst = timezone(timedelta(hours=9))
            token_expires_at = datetime.now(kst) + timedelta(hours=1)
            print(f"[WARN] No expiry provided, setting to 1 hour from now (KST): {token_expires_at}")
        
        # YouTube 사용자 정보 조회
        platform_user_id = None
        email = None
        
        try:
            youtube = build('youtube', 'v3', credentials=credentials)
            channel_response = youtube.channels().list(
                part='snippet',
                mine=True
            ).execute()
            
            if channel_response.get('items'):
                channel = channel_response['items'][0]
                platform_user_id = channel['id']
                email = channel['snippet'].get('title')  # 채널명
        except Exception as e:
            # YouTube API 호출 실패해도 토큰은 저장
            print(f"[WARN] YouTube 채널 정보 조회 실패: {e}")
        
        # DB에 저장
        create_or_update_social_connection(
            db=db,
            user_id=user_id,
            platform='youtube',
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            platform_user_id=platform_user_id,
            email=email,
        )
        
        # 프론트엔드로 리다이렉트 (성공)
        print(f"[SUCCESS] YouTube 연동 성공 - user_id: {user_id}")
        frontend_url = f"{frontend_base_url}/account?youtube_connected=success"
        return RedirectResponse(url=frontend_url, status_code=302)
        
    except Exception as e:
        # 기타 에러 발생 시 프론트엔드로 리다이렉트 (실패)
        print(f"[ERROR] YouTube OAuth 콜백 처리 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        
        error_str = str(e).lower()
        if "consent" in error_str or "verification" in error_str:
            user_message = "YouTube 연동을 위해 Google 인증 설정이 필요합니다. 잠시 후 다시 시도해주세요."
        else:
            user_message = "YouTube 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        
        frontend_url = f"{frontend_base_url}/account?youtube_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)


@router.get("/youtube/status")
def get_youtube_connection_status(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    YouTube 연동 상태 조회
    """
    connection = get_social_connection(db, current_user.id, 'youtube')
    
    if connection:
        return {
            "connected": True,
            "email": connection.email,
            "platform_user_id": connection.platform_user_id,
            "connected_at": connection.connected_at.isoformat() if connection.connected_at else None,
        }
    else:
        return {
            "connected": False,
            "email": None,
            "platform_user_id": None,
            "connected_at": None,
        }


@router.delete("/youtube/disconnect")
def disconnect_youtube(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    YouTube 연동 해제
    """
    try:
        delete_social_connection(db, current_user.id, 'youtube')
        return {"message": "YouTube 연동이 해제되었습니다."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"연동 해제에 실패했습니다: {str(e)}",
        )