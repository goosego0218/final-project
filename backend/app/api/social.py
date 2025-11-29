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

from app.schemas.social import (
    YouTubeUploadRequest, 
    YouTubeUploadResponse,
    InstagramUploadRequest,
    InstagramUploadResponse,
)
from app.services.social_service import (
    upload_video_to_youtube, 
    upload_reels_to_instagram,
    verify_instagram_business_account,
    YOUTUBE_SCOPES,
    INSTAGRAM_SCOPES,
)
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


@router.post("/youtube/upload", response_model=YouTubeUploadResponse)
def upload_video_to_youtube_endpoint(
    request: YouTubeUploadRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    YouTube에 비디오 업로드
    """
    if not GOOGLE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth 라이브러리가 설치되지 않았습니다.",
        )
    
    try:
        result = upload_video_to_youtube(
            db=db,
            user_id=current_user.id,
            video_url=request.video_url,
            title=request.title,
            project_id=request.project_id,
            description=request.description or "",  # 사용 안 함 (백엔드에서 자동 생성)
            tags=request.tags or [],
            privacy=request.privacy,
        )
        
        return YouTubeUploadResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"업로드 중 오류 발생: {str(e)}"
        )


@router.get("/instagram/auth-url")
def get_instagram_auth_url(
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Instagram OAuth 인증 URL 생성
    - Facebook Graph API 사용
    """
    if not settings.facebook_app_id or not settings.facebook_app_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Instagram 연동이 설정되지 않았습니다.",
        )
    
    # CSRF 방지를 위한 state 생성
    state = f"{current_user.id}:{secrets.token_urlsafe(32)}"
    
    # Facebook OAuth URL 생성
    auth_url = (
        f"https://www.facebook.com/v20.0/dialog/oauth?"
        f"client_id={settings.facebook_app_id}&"
        f"redirect_uri={quote(settings.facebook_redirect_uri)}&"
        f"scope={','.join(INSTAGRAM_SCOPES)}&"
        f"state={state}&"
        f"response_type=code"
    )
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.get("/instagram/callback")
def instagram_oauth_callback(
    code: str = Query(None, description="Facebook에서 받은 authorization code"),
    state: str = Query(None, description="CSRF 방지용 state"),
    error: str = Query(None, description="Facebook OAuth 에러"),
    db: Session = Depends(get_orm_session),
):
    """
    Instagram OAuth 콜백 처리
    - code를 access_token으로 교환
    - Instagram Business Account ID 조회
    - DB에 저장
    - 프론트엔드로 리다이렉트
    """
    import requests
    
    frontend_base_url = settings.frontend_url.rstrip('/')
    
    print(f"[DEBUG] Instagram OAuth Callback - code: {code is not None}, state: {state is not None}, error: {error}")
    
    if error:
        print(f"[ERROR] Facebook OAuth 에러: {error}")
        user_message = f"Instagram 연동 중 오류가 발생했습니다. ({error})"
        frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)
    
    if not code or not state:
        print(f"[ERROR] code 또는 state가 없습니다.")
        user_message = "인증 정보를 받을 수 없습니다."
        frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)
    
    try:
        # state에서 user_id 추출
        try:
            user_id_str, _ = state.split(":", 1)
            user_id = int(user_id_str)
        except (ValueError, IndexError):
            frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote("잘못된 요청입니다.")
            return RedirectResponse(url=frontend_url)
        
        # 사용자 확인
        user = db.get(UserInfo, user_id)
        if not user:
            frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote("사용자를 찾을 수 없습니다.")
            return RedirectResponse(url=frontend_url)
        
        # code를 access_token으로 교환
        token_response = requests.post(
            "https://graph.facebook.com/v20.0/oauth/access_token",
            params={
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "redirect_uri": settings.facebook_redirect_uri,
                "code": code,
            }
        )
        
        if token_response.status_code != 200:
            print(f"[ERROR] 토큰 교환 실패: {token_response.text}")
            frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote("토큰 교환에 실패했습니다.")
            return RedirectResponse(url=frontend_url)
        
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 3600)  # 기본 1시간
        
        if not access_token:
            frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote("액세스 토큰을 받을 수 없습니다.")
            return RedirectResponse(url=frontend_url)
        
        # Instagram Business Account ID 조회
        pages_response = requests.get(
            "https://graph.facebook.com/v20.0/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,instagram_business_account"
            }
        )
        
        platform_user_id = None
        email = None
        
        if pages_response.status_code == 200:
            pages_data = pages_response.json()
            for page in pages_data.get('data', []):
                ig_account = page.get('instagram_business_account')
                if ig_account:
                    platform_user_id = ig_account.get('id')
                    # Instagram 계정 정보 조회
                    ig_info_response = requests.get(
                        f"https://graph.facebook.com/v20.0/{platform_user_id}",
                        params={
                            "access_token": access_token,
                            "fields": "id,username"
                        }
                    )
                    if ig_info_response.status_code == 200:
                        ig_info = ig_info_response.json()
                        email = ig_info.get('username', '')
                    break
        
        # 토큰 만료 시간 계산
        kst = timezone(timedelta(hours=9))
        token_expires_at = datetime.now(kst) + timedelta(seconds=expires_in)
        
        # DB에 저장
        create_or_update_social_connection(
            db=db,
            user_id=user_id,
            platform='instagram',
            access_token=access_token,
            refresh_token=None,  # Facebook은 장기 토큰을 별도로 요청해야 함
            token_expires_at=token_expires_at,
            platform_user_id=platform_user_id,
            email=email,
        )
        
        print(f"[SUCCESS] Instagram 연동 성공 - user_id: {user_id}, ig_user_id: {platform_user_id}")
        frontend_url = f"{frontend_base_url}/account?instagram_connected=success"
        return RedirectResponse(url=frontend_url, status_code=302)
        
    except Exception as e:
        print(f"[ERROR] Instagram OAuth 콜백 처리 중 예외 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        
        user_message = "Instagram 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        frontend_url = f"{frontend_base_url}/account?instagram_connected=error&message=" + quote(user_message)
        return RedirectResponse(url=frontend_url, status_code=302)


@router.get("/instagram/status")
def get_instagram_connection_status(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    Instagram 연동 상태 조회
    """
    connection = get_social_connection(db, current_user.id, 'instagram')
    
    if connection:
        # Business Account 확인
        verification = verify_instagram_business_account(db, current_user.id)
        return {
            "connected": True,
            "is_business": verification['is_business'],
            "username": verification['username'],
            "ig_user_id": verification['ig_user_id'],
            "email": connection.email,
            "platform_user_id": connection.platform_user_id,
            "connected_at": connection.connected_at.isoformat() if connection.connected_at else None,
            "error": verification.get('error'),
        }
    else:
        return {
            "connected": False,
            "is_business": False,
            "username": None,
            "ig_user_id": None,
            "email": None,
            "platform_user_id": None,
            "connected_at": None,
            "error": None,
        }


@router.delete("/instagram/disconnect")
def disconnect_instagram(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    Instagram 연동 해제
    """
    try:
        delete_social_connection(db, current_user.id, 'instagram')
        return {"message": "Instagram 연동이 해제되었습니다."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"연동 해제에 실패했습니다: {str(e)}",
        )


@router.post("/instagram/upload", response_model=InstagramUploadResponse)
def upload_reels_to_instagram_endpoint(
    request: InstagramUploadRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    Instagram에 릴스 업로드
    """
    try:
        result = upload_reels_to_instagram(
            db=db,
            user_id=current_user.id,
            video_url=request.video_url,
            caption=request.caption,
            project_id=request.project_id,
            share_to_feed=request.share_to_feed,
        )
        return InstagramUploadResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"업로드 중 오류 발생: {str(e)}"
        )