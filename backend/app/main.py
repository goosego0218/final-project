# 메인 애플리케이션 파일 - FastAPI 앱 생성 및 설정
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성
# - 2025-11-18: 세션 발급 테스트 추가
# - 2025-11-19: 트렌드 에이전트 테스트 엔드포인트 추가
# - 2025-11-28: 댓글 라우터 추가

import os
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.health import router as health_router
from app.api.dbcheck import router as db_router
from app.api.auth import router as auth_router
from app.api.menu import router as menu_router
from app.api.project import router as project_router
from app.api.trend import router as trend_router
from app.api.brand import router as brand_router
from app.api.logo import router as logo_router
from app.api.shorts import router as shorts_router
from app.api.social import router as social_router
from app.api.comment import router as comment_router
from app.api.like import router as like_router

from app.db.session import oracle_db

from fastapi.middleware.cors import CORSMiddleware

# 앱 라이프사이클 관리 
# 앱 시작 시 Oracle DB 풀 초기화
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if settings.langsmith_tracing and settings.langsmith_api_key:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key

        # endpoint / project 는 있을 때만 세팅
        if settings.langsmith_endpoint:
            os.environ["LANGCHAIN_ENDPOINT"] = settings.langsmith_endpoint
        if settings.langsmith_project:
            os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project

        oracle_db.init_pool()
        print("Oracle pool initialized on startup.")
        
        # Kanana Safeguard GPU 서버 연결 확인 (선택적)
        if getattr(settings, 'safeguard_enabled', False):
            safeguard_url = getattr(settings, 'safeguard_server_url', '')
            if safeguard_url:
                print(f"[Startup] Kanana Safeguard GPU 서버: {safeguard_url}")
            else:
                print("[Startup] ⚠️ safeguard_enabled=True이지만 safeguard_server_url이 설정되지 않았습니다")
    except Exception as e:
        print(f"[WARN] Oracle pool init failed: {e}")
    yield # yield 앞은 startup, 뒤는 shutdown 시점
    # 종료 시 DB 풀 종료
    try:
        oracle_db.close_pool()
        print("Oracle pool closed on shutdown.")
    except Exception as e:
        print(f"[WARN] Oracle pool close failed: {e}")


# 앱 라이프사이클 관리 
# 앱 시작 시 Oracle DB 풀 초기화
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if settings.langsmith_tracing and settings.langsmith_api_key:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key

        # endpoint / project 는 있을 때만 세팅
        if settings.langsmith_endpoint:
            os.environ["LANGCHAIN_ENDPOINT"] = settings.langsmith_endpoint
        if settings.langsmith_project:
            os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project

        oracle_db.init_pool()
        print("Oracle pool initialized on startup.")
        
        # Kanana Safeguard GPU 서버 연결 확인 (선택적)
        if getattr(settings, 'safeguard_enabled', False):
            safeguard_url = getattr(settings, 'safeguard_server_url', '')
            if safeguard_url:
                print(f"[Startup] Kanana Safeguard GPU 서버: {safeguard_url}")
            else:
                print("[Startup] ⚠️ safeguard_enabled=True이지만 safeguard_server_url이 설정되지 않았습니다")
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:8081", "http://127.0.0.1:8081"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(db_router)
    app.include_router(auth_router)
    app.include_router(menu_router)
    app.include_router(project_router)
    app.include_router(trend_router)

    app.include_router(brand_router)
    app.include_router(logo_router)
    app.include_router(shorts_router)

    app.include_router(social_router)
    app.include_router(comment_router)
    app.include_router(like_router)
    return app


app = create_app()
