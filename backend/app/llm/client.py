

from typing import Literal

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import settings
from functools import lru_cache

@lru_cache
def get_chat_model():
  
    return ChatOpenAI(
        model=settings.openai_model, 
        api_key=settings.openai_api_key,
        temperature=settings.openai_temperature,
    )

@lru_cache
def get_embeddings():
  
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )
