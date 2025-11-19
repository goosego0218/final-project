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
    openai_model: str = "gpt-5-nano"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_temperature: float = 0.0
    
    langsmith_tracing: bool
    langsmith_endpoint: str
    langsmith_api_key: str
    langsmith_project: str

    oracle_user: str = ""
    oracle_password: str = ""
    oracle_dsn: str = ""
    oracle_schema: str = ""

    jwt_secret_key: str = "" 
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",
    )

settings = Settings()
