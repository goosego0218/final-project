# 모든 LLM 호출 공통 클라이언트
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성
# - 2025-11-18: 임베딩 모델 추가

from typing import Literal

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
def get_embeddings():
    """
    공통 Embeddings 인스턴스.
    """
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )