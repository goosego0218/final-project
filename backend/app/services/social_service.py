# 소셜 미디어 연동 서비스
# 작성자: 황민준
# 작성일: 2025-11-24
# 수정내역
# - 2025-11-24: 초기 작성
# - 2025-11-29: 토큰 암호화/복호화 추가
# - 2025-12-XX: 전략 1 적용 - relationship 제거

from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.social import SocialConnection
from app.models.auth import UserInfo
from app.utils.encryption import encrypt_token, decrypt_token

# YouTube API 스코프
YOUTUBE_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',  # 비디오 업로드
    'https://www.googleapis.com/auth/youtube.readonly'  # 채널 정보 조회 (읽기 전용)
]

# Instagram API 스코프
INSTAGRAM_SCOPES = [
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
]

def get_social_connection(
    db: Session,
    user_id: int,
    platform: str,
) -> Optional[SocialConnection]:
    """
    특정 사용자의 특정 플랫폼 연동 정보 조회.
    - del_yn = 'N'인 것만 조회
    - 토큰은 복호화되어 반환됨
    성능 최적화: 불필요한 relationship 로딩 방지
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
        # refresh 제거: 불필요한 relationship 로딩 방지
        
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
        # refresh 제거: commit 후 이미 connection에 id 등이 설정되어 있음
        # 불필요한 relationship 로딩 방지
        
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

def upload_video_to_youtube(
    db: Session,
    user_id: int,
    video_url: str,
    title: str,
    project_id: int,
    description: str = "",
    tags: list[str] = None,
    privacy: str = "public",
) -> dict:
    """
    YouTube에 비디오 업로드
    
    Args:
        db: SQLAlchemy Session
        user_id: 사용자 ID
        video_url: NCP Object Storage의 비디오 URL
        title: 영상 제목
        project_id: 프로젝트 ID (브랜드 프로필 가져오기 위해)
        description: 영상 설명 (사용 안 함, 브랜드 프로필에서 자동 생성)
        tags: 태그 리스트
        privacy: 'public', 'private', 'unlisted'
        
    Returns:
        dict: {
            'success': bool,
            'video_id': str,
            'video_url': str,
            'shorts_url': str,
            'message': str
        }
        
    Raises:
        ValueError: 연동 정보가 없거나 업로드 실패 시
    """
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        from googleapiclient.errors import HttpError
        import httpx
        import tempfile
        import os
        from app.core.config import settings
    except ImportError as e:
        raise ValueError(f"필수 라이브러리가 설치되지 않았습니다: {str(e)}")
    
    # 1. 사용자의 YouTube 연동 정보 가져오기 (복호화된 토큰 반환)
    connection = get_social_connection(db, user_id, 'youtube')
    if not connection:
        raise ValueError("YouTube 연동이 필요합니다.")
    
    # 2. 토큰으로 Credentials 생성 (이미 복호화된 상태)
    credentials = Credentials(
        token=connection.access_token,
        refresh_token=connection.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=YOUTUBE_SCOPES
    )
    
    # 3. 토큰 만료 시 갱신
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        # 갱신된 토큰 저장 (암호화는 create_or_update_social_connection에서 처리)
        kst = timezone(timedelta(hours=9))
        token_expires_at = credentials.expiry.astimezone(kst) if credentials.expiry else None
        
        create_or_update_social_connection(
            db=db,
            user_id=user_id,
            platform='youtube',
            access_token=credentials.token,  # 평문 토큰 전달 (서비스에서 암호화)
            refresh_token=credentials.refresh_token,  # 평문 토큰 전달 (서비스에서 암호화)
            token_expires_at=token_expires_at,
            platform_user_id=connection.platform_user_id,
            email=connection.email,
        )
    
    # 4. 비디오 파일 다운로드 (NCP Object Storage에서)
    temp_file = None
    try:
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
            temp_file = tmp.name
        
        # 비디오 다운로드
        with httpx.Client(timeout=300.0) as client:  # 5분 타임아웃
            with client.stream('GET', video_url) as response:
                response.raise_for_status()
                with open(temp_file, 'wb') as f:
                    for chunk in response.iter_bytes():
                        f.write(chunk)
        
        # 5. 브랜드 프로필에서 설명 자동 생성
        from app.services.project_service import load_brand_profile_for_agent
        from app.agents.state import BrandProfile
        import re
        
        brand_profile: BrandProfile = load_brand_profile_for_agent(db, project_id)
        
        # core_keywords를 해시태그로 변환하는 함수
        def generate_description_from_keywords(brand_profile: BrandProfile) -> str:
            hashtags = []
            
            # core_keywords가 있으면 해시태그로 변환
            if brand_profile.get("core_keywords"):
                keywords_str = brand_profile["core_keywords"]
                # 콤마, 슬래시, 공백 등으로 구분된 키워드 파싱
                keywords = re.split(r'[,/，、\s]+', keywords_str)
                for keyword in keywords:
                    keyword = keyword.strip()
                    if keyword:
                        # 띄어쓰기 제거하고 해시태그로 변환
                        hashtag = f"#{keyword.replace(' ', '')}"
                        hashtags.append(hashtag)
            
            # 기본 해시태그 추가
            hashtags.extend(["#Shorts", "#YouTubeShorts", "#ShortsVideo"])
            
            return " ".join(hashtags)
        
        generated_description = generate_description_from_keywords(brand_profile)
        
        # 6. YouTube API를 사용하여 업로드
        youtube = build('youtube', 'v3', credentials=credentials)
        
        # Shorts 최적화된 메타데이터 설정
        body = {
            'snippet': {
                'title': title,  # 사용자 입력 제목 그대로 사용
                'description': generated_description,  # 자동 생성된 설명 사용
                'tags': tags or [],  # 사용자 입력 태그만 사용
                'categoryId': '22'  # 사람 및 블로그
            },
            'status': {
                'privacyStatus': privacy,
                'selfDeclaredMadeForKids': False
            }
        }
        
        # 영상 파일 업로드
        media = MediaFileUpload(
            temp_file,
            mimetype='video/*',
            resumable=True,
            chunksize=1024*1024  # 1MB chunks
        )
        
        upload_request = youtube.videos().insert(
            part='snippet,status',
            body=body,
            media_body=media
        )
        
        response = None
        print(f"[INFO] YouTube 업로드 시작: {title}")
        while response is None:
            status, response = upload_request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                print(f"[INFO] 업로드 진행: {progress}%")
        
        video_id = response['id']
        video_url_youtube = f"https://www.youtube.com/watch?v={video_id}"
        shorts_url = f"https://www.youtube.com/shorts/{video_id}"
        
        print(f"[SUCCESS] YouTube 업로드 완료 - video_id: {video_id}")
        
        return {
            'success': True,
            'video_id': video_id,
            'video_url': video_url_youtube,
            'shorts_url': shorts_url,
            'message': 'YouTube에 성공적으로 업로드되었습니다.'
        }
        
    except HttpError as e:
        print(f"[ERROR] YouTube 업로드 HTTP 에러: {e}")
        raise ValueError(f"YouTube 업로드 실패: {str(e)}")
    except Exception as e:
        print(f"[ERROR] YouTube 업로드 중 오류: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"업로드 중 오류 발생: {str(e)}")
    finally:
        # 임시 파일 삭제
        if temp_file and os.path.exists(temp_file):
            try:
                os.unlink(temp_file)
            except Exception as e:
                print(f"[WARN] 임시 파일 삭제 실패: {e}")


def verify_instagram_business_account(
    db: Session,
    user_id: int,
) -> dict:
    """
    Instagram Business Account 확인 및 정보 조회
    
    Returns:
        dict: {
            'is_business': bool,
            'ig_user_id': str | None,
            'username': str | None,
            'error': str | None
        }
    """
    import requests
    
    connection = get_social_connection(db, user_id, 'instagram')
    if not connection:
        return {
            'is_business': False,
            'ig_user_id': None,
            'username': None,
            'error': 'Instagram 연동이 필요합니다.'
        }
    
    access_token = connection.access_token
    
    try:
        # Facebook 페이지 목록 조회
        pages_response = requests.get(
            "https://graph.facebook.com/v20.0/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,instagram_business_account"
            }
        )
        
        if pages_response.status_code != 200:
            return {
                'is_business': False,
                'ig_user_id': None,
                'username': None,
                'error': f'페이지 조회 실패: {pages_response.text}'
            }
        
        pages_data = pages_response.json()
        
        # Instagram Business Account가 연결된 페이지 찾기
        for page in pages_data.get('data', []):
            ig_account = page.get('instagram_business_account')
            if ig_account:
                ig_user_id = ig_account.get('id')
                
                # Instagram 계정 정보 조회
                ig_info_response = requests.get(
                    f"https://graph.facebook.com/v20.0/{ig_user_id}",
                    params={
                        "access_token": access_token,
                        "fields": "id,username,account_type"
                    }
                )
                
                if ig_info_response.status_code == 200:
                    ig_info = ig_info_response.json()
                    return {
                        'is_business': True,
                        'ig_user_id': ig_user_id,
                        'username': ig_info.get('username'),
                        'error': None
                    }
        
        return {
            'is_business': False,
            'ig_user_id': None,
            'username': None,
            'error': 'Instagram Business Account가 연결된 Facebook 페이지를 찾을 수 없습니다.'
        }
        
    except Exception as e:
        return {
            'is_business': False,
            'ig_user_id': None,
            'username': None,
            'error': f'확인 중 오류 발생: {str(e)}'
        }


def upload_reels_to_instagram(
    db: Session,
    user_id: int,
    video_url: str,
    caption: str,
    project_id: int,
    share_to_feed: bool = True,
) -> dict:
    """
    Instagram에 릴스 업로드
    
    Args:
        db: SQLAlchemy Session
        user_id: 사용자 ID
        video_url: NCP Object Storage의 비디오 URL
        caption: 릴스 캡션
        project_id: 프로젝트 ID (브랜드 프로필 가져오기 위해)
        share_to_feed: 릴스+피드에 함께 올리기 여부
        
    Returns:
        dict: {
            'success': bool,
            'media_id': str,
            'message': str
        }
        
    Raises:
        ValueError: 연동 정보가 없거나 업로드 실패 시
    """
    import requests
    import time
    from app.services.project_service import load_brand_profile_for_agent
    from app.agents.state import BrandProfile
    
    # 1. Instagram Business Account 확인
    verification = verify_instagram_business_account(db, user_id)
    if not verification['is_business']:
        raise ValueError(
            verification['error'] or 
            "Instagram Business Account가 필요합니다. Facebook 페이지와 연결된 Business Account를 확인해주세요."
        )
    
    access_token = get_social_connection(db, user_id, 'instagram').access_token
    ig_user_id = verification['ig_user_id']
    
    # 2. 브랜드 프로필에서 해시태그 자동 생성
    brand_profile: BrandProfile = load_brand_profile_for_agent(db, project_id)
    
    # core_keywords를 해시태그로 변환
    hashtags = []
    if brand_profile.get("core_keywords"):
        import re
        keywords_str = brand_profile["core_keywords"]
        keywords = re.split(r'[,/，、\s]+', keywords_str)
        for keyword in keywords:
            keyword = keyword.strip()
            if keyword:
                hashtag = f"#{keyword.replace(' ', '')}"
                hashtags.append(hashtag)
    
    # 캡션에 해시태그 추가
    if hashtags:
        caption_with_hashtags = f"{caption}\n\n{' '.join(hashtags)}"
    else:
        caption_with_hashtags = caption
    
    # 3. 컨테이너 생성 (Step 1)
    create_response = requests.post(
        f"https://graph.facebook.com/v20.0/{ig_user_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption_with_hashtags,
            "share_to_feed": "true" if share_to_feed else "false",
            "access_token": access_token,
        }
    )
    
    if create_response.status_code != 200:
        raise ValueError(f"컨테이너 생성 실패: {create_response.text}")
    
    create_data = create_response.json()
    container_id = create_data.get("id")
    
    if not container_id:
        raise ValueError(f"컨테이너 생성 실패: {create_data}")
    
    print(f"[INFO] Instagram 컨테이너 생성 완료 - container_id: {container_id}")
    
    # 4. 업로드 처리 상태 확인 (Step 2)
    max_attempts = 30  # 최대 150초 대기 (5초 간격)
    for attempt in range(max_attempts):
        status_response = requests.get(
            f"https://graph.facebook.com/v20.0/{container_id}",
            params={
                "fields": "status_code",
                "access_token": access_token,
            }
        )
        
        if status_response.status_code != 200:
            raise ValueError(f"상태 확인 실패: {status_response.text}")
        
        status_data = status_response.json()
        status_code = status_data.get("status_code")
        
        print(f"[INFO] Instagram 상태 확인 ({attempt + 1}/{max_attempts}): {status_code}")
        
        if status_code == "FINISHED":
            break
        elif status_code in ("ERROR", "EXPIRED"):
            raise ValueError(f"릴스 처리 실패: {status_data}")
        
        time.sleep(5)  # 5초 대기
    else:
        raise ValueError("릴스 처리 시간 초과")
    
    # 5. 실제 릴스 게시 (Step 3)
    publish_response = requests.post(
        f"https://graph.facebook.com/v20.0/{ig_user_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": access_token,
        }
    )
    
    if publish_response.status_code != 200:
        raise ValueError(f"릴스 게시 실패: {publish_response.text}")
    
    publish_data = publish_response.json()
    media_id = publish_data.get("id")
    
    if not media_id:
        raise ValueError(f"릴스 게시 실패: {publish_data}")
    
    print(f"[SUCCESS] Instagram 릴스 업로드 완료 - media_id: {media_id}")
    
    return {
        'success': True,
        'media_id': media_id,
        'message': 'Instagram에 성공적으로 업로드되었습니다.'
    }