# 서버 테스트
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성

from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
def health_check():
    return {
        "status": "ok",
        "environment": settings.app_env,
        "app_name": settings.app_name,
        "version": settings.app_version,
    }
