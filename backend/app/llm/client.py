# 모든 LLM 호출 공통 클라이언트
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성
# - 2025-11-18: 임베딩 모델 추가

from typing import Literal
import os 
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import settings
from functools import lru_cache
# lru_cache: 함수의 리턴 값을 캐싱해두는 데코레이터

@lru_cache
def get_chat_model():
    """
    프로젝트 전체에서 사용하는 기본 모델.
    OPENAI_MODEL 값 사용.
    """

    return ChatOpenAI(
        model=settings.openai_model, 
        api_key=settings.openai_api_key,
        temperature=settings.openai_temperature,
    )

@lru_cache
def get_fast_chat_model():
    """
    간단 답변 및 빠르게 구현하기 위한 모델
    gpt-4o-mini
    """
    return ChatOpenAI(
        model=settings.fast_openai_model, 
        api_key=settings.openai_api_key,
        temperature=settings.openai_temperature,
    )

@lru_cache
def get_embeddings():
    """
    공통 Embeddings 인스턴스.
    """
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )

@lru_cache
def get_genai_client():
    """
    Google GenAI 클라이언트 (Veo 3.1 영상 생성용)
    Vertex AI + 서비스 계정 인증
    """
    from google import genai
    
    # 서비스 계정 JSON 파일 경로
    credentials_path = os.path.join("credentials", "google-service-account.json")
    
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(
            f"서비스 계정 JSON 파일이 없습니다: {credentials_path}\n"
            "Google Cloud Console에서 서비스 계정 키를 다운로드하여 해당 경로에 저장하세요."
        )
    
    # 환경변수로 인증 정보 설정
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    
    # Vertex AI 모드로 클라이언트 생성
    return genai.Client(
        vertexai=True,
        project=settings.google_cloud_project,
        location=settings.google_cloud_location
    )

@lru_cache
def get_gemini_image_client():
    """
    Google Gemini 이미지 생성 클라이언트 (로고용)
    """
    from google import genai
    
    if not settings.google_genai_api_key:
        raise ValueError(
            "GOOGLE_GENAI_API_KEY가 설정되지 않았습니다.\n"
            ".env 파일에 GOOGLE_GENAI_API_KEY를 추가하세요."
        )
    
    # API Key 모드로 클라이언트 생성 (Veo와 다름!)
    return genai.Client(api_key=settings.google_genai_api_key)    