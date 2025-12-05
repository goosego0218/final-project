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
def get_logo_prompt_model():
    """
    프롬프트 생성용 모델
    """
    return ChatOpenAI(
        model="gpt-5",
        api_key=settings.openai_api_key,
        temperature=0.15,
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
    API Key 방식 사용 (서비스 계정 파일 불필요)
    """
    from google import genai
    import logging
    
    logger = logging.getLogger(__name__)
    
    # API 키가 없으면 None 반환 (에러 대신)
    if not settings.google_genai_api_key:
        logger.warning(
            "Google GenAI API 키가 설정되지 않았습니다.\n"
            "숏폼 생성 기능을 사용하려면 google_genai_api_key를 설정하세요."
        )
        return None
    
    # API Key 방식으로 클라이언트 생성
    try:
        return genai.Client(
            api_key=settings.google_genai_api_key,
        )
    except Exception as e:
        logger.error(f"GenAI 클라이언트 생성 실패: {e}")
        return None

@lru_cache
def get_gemini_image_client():
    """
    로고 이미지 생성용 Gemini 클라이언트
    """
    from google import genai
    
    return genai.Client(
        api_key=settings.google_genai_api_key,
    )