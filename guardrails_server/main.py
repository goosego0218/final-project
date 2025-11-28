"""
Kanana Safeguard GPU 서버
독립적으로 실행 가능한 FastAPI 서버
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from contextlib import asynccontextmanager

from guardrails.kanana_safeguard import get_safeguard_instance


# 전역 모델 인스턴스
safeguard = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 시 모델 로드/해제"""
    global safeguard
    
    # 시작 시 모델 로드
    try:
        print("[Guardrails Server] Kanana Safeguard 모델 로딩 시작...")
        safeguard = get_safeguard_instance("general")
        print("[Guardrails Server] ✅ 모델 로딩 완료")
    except Exception as e:
        print(f"[Guardrails Server] ❌ 모델 로딩 실패: {e}")
        import traceback
        traceback.print_exc()
        safeguard = None
    
    yield
    
    # 종료 시 정리 (필요시)
    print("[Guardrails Server] 서버 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="Kanana Safeguard API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 필요시 특정 origin으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청/응답 모델
class CheckRequest(BaseModel):
    text: str
    assistant_prompt: str = ""


class CheckResponse(BaseModel):
    is_safe: bool
    risk_code: Optional[str] = None
    raw_output: str


# API 엔드포인트
@app.post("/guardrails/check", response_model=CheckResponse)
async def check_text(request: CheckRequest):
    """
    텍스트 안전성 검사
    
    - Input 체크: assistant_prompt가 빈 문자열
    - Output 체크: assistant_prompt에 AI 응답 포함
    """
    if safeguard is None:
        return CheckResponse(
            is_safe=True,
            risk_code=None,
            raw_output="<SAFE>"
        )
    
    result = safeguard.check(request.text, request.assistant_prompt)
    return CheckResponse(**result)


@app.get("/health")
async def health():
    """헬스 체크"""
    return {
        "status": "ok",
        "model_loaded": safeguard is not None
    }


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "service": "Kanana Safeguard API",
        "version": "1.0.0",
        "endpoints": {
            "check": "/guardrails/check",
            "health": "/health"
        }
    }


if __name__ == "__main__":
    # 서버 실행
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )

