# 메인 애플리케이션 파일 - FastAPI 앱 생성 및 설정
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성
# - 2025-11-18: 세션 발급 테스트 추가

from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.health import router as health_router
from app.api.dbcheck import router as db_router
from app.api.auth import router as auth_router
from app.api.menu import router as menu_router
from app.api.project import router as project_router
from app.db.session import oracle_db

# 앱 라이프사이클 관리 
# 앱 시작 시 Oracle DB 풀 초기화
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        oracle_db.init_pool()
        print("Oracle pool initialized on startup.")
    except Exception as e:
        print(f"[WARN] Oracle pool init failed: {e}")
    yield # yield 앞은 startup, 뒤는 shutdown 시점
    # 종료 시 DB 풀 종료
    try:
        oracle_db.close_pool()
        print("Oracle pool closed on shutdown.")
    except Exception as e:
        print(f"[WARN] Oracle pool close failed: {e}")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(db_router)
    app.include_router(auth_router)
    app.include_router(menu_router)
    app.include_router(project_router)
    return app


app = create_app()
