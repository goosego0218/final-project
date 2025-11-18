# 모든 LLM 호출
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from typing import Literal

from langchain_openai import ChatOpenAI
from app.core.config import settings

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