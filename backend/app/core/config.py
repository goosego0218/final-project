# 코어 설정 관리
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "local"
    app_name: str = "brand-ai-backend"
    app_version: str = "0.0.1"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Brandbot/LLM 통합 환경 변수 (벤더링된 에이전트 호환용)
    openai_model_chat: str | None = None
    openai_model_embed: str | None = None
    openai_temperature: float | None = None

    vector_backend: str | None = None
    rdb_driver: str | None = None
    sqlite_path: str | None = None
    embedding_model: str | None = None
    thread_id: str | None = None

    tavily_api_key: str | None = None

    langsmith_tracing: bool | None = None
    langsmith_endpoint: str | None = None
    langsmith_api_key: str | None = None
    langsmith_project: str | None = None

    oracle_user: str = ""
    oracle_password: str = ""
    oracle_dsn: str = ""
    oracle_schema: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",
    )

settings = Settings()
