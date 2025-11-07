# src/brandbot/config.py
from __future__ import annotations
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    model_chat: str = os.getenv("OPENAI_MODEL_CHAT", "gpt-4o-mini")
    model_embed: str = os.getenv("OPENAI_MODEL_EMBED", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
    temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
    
    # Vector Store backend (faiss | chroma)
    vector_backend: str = os.getenv("VECTOR_BACKEND", "chroma")
    
    # RDB Driver (sqlite | oracle)
    rdb_driver: str = os.getenv("RDB_DRIVER", "sqlite")
    
    # SQLite DB File
    sqlite_path: str = os.getenv("SQLITE_PATH", "brandbot.db")
    
    # LangGraph Thread ID
    thread_id: str = os.getenv("THREAD_ID", "brandbot-cli")
    
    # Tavily API Key
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    
    # LangSmith Tracing
    langsmith_tracing: bool = os.getenv("LANGSMITH_TRACING", "false").lower() == "true"
    langsmith_endpoint: str = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    langsmith_api_key: str = os.getenv("LANGSMITH_API_KEY", "")
    langsmith_project: str = os.getenv("LANGSMITH_PROJECT", "LANGCHAIN_PROJECT")

SETTINGS = Settings()

# LangSmith Tracing 설정 (환경 변수가 설정되어 있으면 자동으로 활성화)
def setup_langsmith():
    """LangSmith Tracing을 설정합니다. 환경 변수가 설정되어 있으면 자동으로 활성화됩니다."""
    if SETTINGS.langsmith_tracing and SETTINGS.langsmith_api_key:
        # LangChain은 환경 변수를 자동으로 읽습니다
        # 하지만 명시적으로 설정하는 것이 더 안전합니다
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_ENDPOINT", SETTINGS.langsmith_endpoint)
        os.environ.setdefault("LANGCHAIN_API_KEY", SETTINGS.langsmith_api_key)
        os.environ.setdefault("LANGCHAIN_PROJECT", SETTINGS.langsmith_project)
        
        print(f"[LangSmith] Tracing 활성화됨: project={SETTINGS.langsmith_project}")
    else:
        print("[LangSmith] Tracing 비활성화됨 (환경 변수 확인 필요)")

# 모듈 로드 시 자동 설정
setup_langsmith()
