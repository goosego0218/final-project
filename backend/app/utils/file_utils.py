# 파일 관련 유틸리티
# 작성일: 2025-11-23
# 수정내역
# - 2025-11-23: 초기 작성

from urllib.parse import urljoin
from app.core.config import settings


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

