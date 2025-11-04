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
