# 파일 관련 유틸리티
# 작성일: 2025-11-23
# 수정내역
# - 2025-11-23: 초기 작성

from urllib.parse import urljoin
from app.core.config import settings
import base64
import uuid
from datetime import datetime
import boto3
from botocore.client import Config


def get_file_url(file_path: str | None) -> str | None:
    """
    파일 경로를 완전한 파일 서버 URL로 변환합니다.
    
    Args:
        file_path: 상대 경로 (예: "/media/logo/edited_output.png") 또는 None
        
    Returns:
        완전한 URL (예: "https://kr.object.ncloudstorage.com/aissemble/media/logo/edited_output.png")
        file_path가 None이거나 빈 문자열이면 None 반환
    """
    if not file_path:
        return None
    
    # 이미 완전한 URL인 경우 그대로 반환
    if file_path.startswith("http://") or file_path.startswith("https://"):
        return file_path
    
    # 상대 경로인 경우 파일 서버 URL과 결합
    # file_path가 "/"로 시작하지 않으면 추가
    if not file_path.startswith("/"):
        file_path = "/" + file_path
    
    # 파일 서버 URL과 결합
    base_url = settings.file_server_url.rstrip("/")
    return urljoin(base_url + "/", file_path.lstrip("/"))


def get_file_path_from_url(url: str | None) -> str | None:
    """
    완전한 파일 서버 URL에서 상대 경로를 추출합니다.
    
    Args:
        url: 완전한 URL (예: "https://kr.object.ncloudstorage.com/aissemble/media/logo/edited_output.png")
        
    Returns:
        상대 경로 (예: "/media/logo/edited_output.png")
        url이 None이거나 파일 서버 URL이 아니면 None 반환
    """
    if not url:
        return None
    
    base_url = settings.file_server_url.rstrip("/")
    
    # 파일 서버 URL로 시작하는지 확인
    if not url.startswith(base_url):
        return None
    
    # 상대 경로 추출
    relative_path = url[len(base_url):]
    
    # "/"로 시작하도록 보장
    if not relative_path.startswith("/"):
        relative_path = "/" + relative_path
    
    return relative_path

def upload_base64_to_ncp(
    base64_data: str,
    file_type: str = "shorts",  # "shorts" or "logo"
    project_id: int | None = None
) -> str:
    """
    Base64 데이터를 NCP Object Storage에 업로드하고 파일 경로 반환
    
    Args:
        base64_data: Base64 인코딩된 데이터 (data:video/mp4;base64,... 형식도 가능)
        file_type: "shorts" 또는 "logo"
        project_id: 프로젝트 ID (선택)
        
    Returns:
        업로드된 파일의 상대 경로 (예: "/media/shorts/20251128/uuid.mp4")
    """
    # data:video/mp4;base64, 또는 data:image/png;base64, 제거
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]
    
    # Base64 디코딩
    file_bytes = base64.b64decode(base64_data)
    
    # 파일 확장자 결정
    extension = "mp4" if file_type == "shorts" else "png"
    
    # 파일명 생성: 날짜/UUID.확장자
    today = datetime.now().strftime("%Y%m%d")
    filename = f"{uuid.uuid4()}.{extension}"
    
    # 경로 생성: /media/{file_type}/{날짜}/{파일명}
    file_path = f"/media/{file_type}/{today}/{filename}"
    
    # NCP Object Storage 업로드
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.ncp_access_key,
            aws_secret_access_key=settings.ncp_secret_key,
            endpoint_url=settings.ncp_endpoint,
            region_name=settings.ncp_region,
            config=Config(signature_version='s3v4')
        )
        
        # 파일 업로드 (버킷명/media/shorts/날짜/파일명.mp4)
        s3_key = file_path.lstrip("/")  # 앞의 "/" 제거
        
        content_type = "video/mp4" if file_type == "shorts" else "image/png"
        
        s3_client.put_object(
            Bucket=settings.ncp_bucket_name,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            ACL='public-read'  # 공개 읽기 (필요시 조정)
        )
        
        return file_path
        
    except Exception as e:
        raise RuntimeError(f"NCP Object Storage 업로드 실패: {str(e)}")