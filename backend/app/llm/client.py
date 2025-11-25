

from typing import Literal

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import settings
from functools import lru_cache

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
  
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )
