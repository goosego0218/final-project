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

from app.models.social import SocialConnection, SocialPost
from app.models.auth import UserInfo
from app.models.project import GenerationProd
from app.utils.encryption import encrypt_token, decrypt_token
from app.utils.file_utils import get_file_path_from_url
from app.services.shorts_service import save_shorts_to_storage_and_db
import base64

# YouTube API 스코프
YOUTUBE_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',  # 비디오 업로드
    'https://www.googleapis.com/auth/youtube.readonly'  # 채널 정보 조회 (읽기 전용)
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
    prod_id: Optional[int] = None,  # 생성물 ID (선택적, 없으면 video_url로 찾음)
) -> dict:
    """
    YouTube에 비디오 업로드 및 social_post 테이블에 기록 저장
    
    Args:
        db: SQLAlchemy Session
        user_id: 사용자 ID
        video_url: NCP Object Storage의 비디오 URL
        title: 영상 제목
        project_id: 프로젝트 ID (브랜드 프로필 가져오기 위해)
        description: 영상 설명 (사용 안 함, 브랜드 프로필에서 자동 생성)
        tags: 태그 리스트
        privacy: 'public', 'private', 'unlisted'
        prod_id: 생성물 ID (선택적, 없으면 video_url로 찾음)
        
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
    
    # 0. prod_id 찾기 또는 프로젝트에 저장 (중복 저장 방지)
    if not prod_id:
        file_path = get_file_path_from_url(video_url)
        if file_path:
            # 이미 NCP에 저장된 파일인 경우 file_path로 찾기
            prod = (
                db.query(GenerationProd)
                .filter(
                    GenerationProd.file_path == file_path,
                    GenerationProd.del_yn == 'N'
                )
                .first()
            )
            if prod:
                prod_id = prod.prod_id
                print(f"[INFO] 기존 생성물 사용: prod_id={prod_id}")
            else:
                # file_path는 있지만 DB에 없는 경우 (비정상)
                print(f"[WARN] file_path로 prod_id를 찾을 수 없습니다: {file_path}")
        else:
            # NCP URL이 아닌 경우 (임시 URL 등) - 비디오 다운로드 후 저장 필요
            print(f"[INFO] video_url이 NCP URL이 아닙니다. 비디오를 다운로드하여 저장합니다: {video_url}")
    
    # prod_id가 없으면 video_url에서 비디오 다운로드 후 프로젝트에 저장
    if not prod_id:
        try:
            import httpx
            # 비디오 다운로드
            with httpx.Client(timeout=300.0) as client:
                response = client.get(video_url)
                response.raise_for_status()
                video_bytes = response.content
            
            # Base64로 인코딩
            base64_video = base64.b64encode(video_bytes).decode('utf-8')
            # Data URL 형식으로 변환
            base64_video = f"data:video/mp4;base64,{base64_video}"
            
            # 프로젝트에 저장 (중복 저장 방지)
            prod = save_shorts_to_storage_and_db(
                db=db,
                base64_video=base64_video,
                project_id=project_id,
                prod_type_id=2,  # 쇼츠 타입
                user_id=user_id,
            )
            prod_id = prod.prod_id
            print(f"[INFO] 비디오를 프로젝트에 저장 완료: prod_id={prod_id}")
        except Exception as e:
            print(f"[ERROR] 비디오 다운로드 및 저장 실패: {e}")
            raise ValueError(f"비디오를 프로젝트에 저장하는데 실패했습니다: {str(e)}")
    
    # 1. 사용자의 YouTube 연동 정보 가져오기 (복호화된 토큰 반환)
    connection = get_social_connection(db, user_id, 'youtube')
    if not connection:
        # social_post 레코드 생성 (연동 실패 시)
        if prod_id:
            kst = timezone(timedelta(hours=9))
            social_post = SocialPost(
                prod_id=prod_id,
                conn_id=0,  # 임시값 (연동 정보가 없으므로)
                platform='youtube',
                status='FAIL',
                error_message="YouTube 연동이 필요합니다.",
                requested_at=datetime.now(kst)
            )
            db.add(social_post)
            db.commit()
        raise ValueError("YouTube 연동이 필요합니다.")
    
    # social_post 레코드 생성 (업로드 시작 시점)
    social_post = None
    if prod_id:
        kst = timezone(timedelta(hours=9))
        social_post = SocialPost(
            prod_id=prod_id,
            conn_id=connection.conn_id,
            platform='youtube',
            status='PENDING',
            requested_at=datetime.now(kst)
        )
        db.add(social_post)
        db.flush()  # post_id 생성
    
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
            
            
            return " ".join(hashtags) if hashtags else ""
        
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
        media = None
        upload_request = None
        try:
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
        finally:
            # MediaFileUpload 객체 명시적 해제 (파일 핸들 닫기)
            if media:
                try:
                    if hasattr(media, 'close'):
                        media.close()
                except Exception:
                    pass
        
        # social_post 업데이트 (성공)
        if social_post:
            kst = timezone(timedelta(hours=9))
            social_post.status = 'SUCCESS'
            social_post.platform_post_id = video_id
            social_post.platform_url = video_url_youtube
            social_post.posted_at = datetime.now(kst)
            db.commit()
        
        return {
            'success': True,
            'video_id': video_id,
            'video_url': video_url_youtube,
            'shorts_url': shorts_url,
            'message': 'YouTube에 성공적으로 업로드되었습니다.'
        }
        
    except HttpError as e:
        print(f"[ERROR] YouTube 업로드 HTTP 에러: {e}")
        error_msg = str(e)
        # social_post 업데이트 (실패)
        if social_post:
            kst = timezone(timedelta(hours=9))
            social_post.status = 'FAIL'
            social_post.error_message = error_msg[:1000]  # 최대 길이 제한
            if hasattr(e, 'status_code'):
                social_post.error_code = str(e.status_code)
            db.commit()
        raise ValueError(f"YouTube 업로드 실패: {error_msg}")
    except Exception as e:
        print(f"[ERROR] YouTube 업로드 중 오류: {e}")
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        # social_post 업데이트 (실패)
        if social_post:
            kst = timezone(timedelta(hours=9))
            social_post.status = 'FAIL'
            social_post.error_message = error_msg[:1000]  # 최대 길이 제한
            db.commit()
        raise ValueError(f"업로드 중 오류 발생: {error_msg}")
    finally:
        # 임시 파일 삭제 (재시도 로직 포함)
        if temp_file and os.path.exists(temp_file):
            import time
            max_retries = 3
            retry_delay = 0.5  # 0.5초 대기
            
            for attempt in range(max_retries):
                try:
                    # 파일 핸들이 해제될 시간을 주기 위해 짧은 지연
                    if attempt > 0:
                        time.sleep(retry_delay * attempt)
                    os.unlink(temp_file)
                    print(f"[INFO] 임시 파일 삭제 완료: {temp_file}")
                    break
                except PermissionError as e:
                    if attempt < max_retries - 1:
                        print(f"[WARN] 임시 파일 삭제 재시도 ({attempt + 1}/{max_retries}): {temp_file}")
                        continue
                    else:
                        print(f"[WARN] 임시 파일 삭제 실패 (최대 재시도 횟수 초과): {e}")
                except Exception as e:
                    print(f"[WARN] 임시 파일 삭제 실패: {e}")
                    break


def upload_video_to_tiktok(
    db: Session,
    user_id: int,
    video_url: str,
    caption: str,
    project_id: int,
) -> dict:
    """
    TikTok Draft 업로드 (FILE_UPLOAD 방식).

    Args:
        db: SQLAlchemy Session
        user_id: 사용자 ID
        video_url: NCP Object Storage의 비디오 URL
        caption: TikTok 캡션(타이틀)
        project_id: 프로젝트 ID (로깅/확장용)

    Returns:
        dict: {
            'success': bool,
            'publish_id': str | None,
            'message': str,
        }

    Raises:
        ValueError: 연동 정보가 없거나 업로드 실패 시
    """
    try:
        import httpx
        import requests
        from app.core.config import settings

        # 1. TikTok 연동 정보 조회
        connection = get_social_connection(db, user_id, 'tiktok')
        if not connection:
            raise ValueError("TikTok 연동이 필요합니다.")

        access_token = connection.access_token

        # 2. NCP에서 영상 다운로드
        with httpx.Client(timeout=300.0) as client:
            with client.stream('GET', video_url) as response:
                response.raise_for_status()
                video_bytes = response.read()

        file_size = len(video_bytes)
        if file_size == 0:
            raise ValueError("영상 파일 크기가 0입니다.")

        # 3. TikTok init (FILE_UPLOAD)
        init_url = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        body = {
            "post_info": {
                "title": caption or "AI 마케팅 파트너 자동 업로드",
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": file_size,
                "chunk_size": file_size,
                "total_chunk_count": 1,
            },
        }

        init_resp = requests.post(init_url, headers=headers, json=body, timeout=30)
        init_data = init_resp.json()

        error = init_data.get("error") or {}
        if error.get("code") not in (None, "", "ok"):
            raise ValueError(f"TikTok init 실패: {init_data}")

        data = init_data.get("data") or {}
        publish_id = data.get("publish_id")
        upload_url = data.get("upload_url")

        if not upload_url:
            raise ValueError("TikTok init 응답에 upload_url이 없습니다.")

        # 4. TikTok upload (단일 청크)
        content_range = f"bytes 0-{file_size - 1}/{file_size}"

        upload_headers = {
            "Content-Type": "video/mp4",
            "Content-Range": content_range,
        }

        upload_resp = requests.put(
            upload_url,
            headers=upload_headers,
            data=video_bytes,
            timeout=300,
        )

        # 응답 바디는 지금은 로그 용도만, API에서는 success/메시지만 넘깁니다.
        try:
            if upload_resp.content:
                upload_data = upload_resp.json()
            else:
                upload_data = {"status_code": upload_resp.status_code}
            print(f"[DEBUG] TikTok upload response: {upload_data}")
        except Exception:
            print(f"[WARN] TikTok upload 응답 JSON 파싱 실패: {upload_resp.text[:500]}")

        return {
            "success": True,
            "publish_id": publish_id,
            "message": "TikTok Draft 업로드 요청 완료.",
        }

    except ValueError:
        # 서비스 레이어에서 의미 있는 메시지 그대로 위로 올림
        raise
    except Exception as e:
        print(f"[ERROR] TikTok 업로드 중 오류: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"업로드 중 오류 발생: {str(e)}")

        