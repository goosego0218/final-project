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

    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-5-nano"
    fast_openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_temperature: float = 0.0
    
    langsmith_tracing: bool
    langsmith_endpoint: str
    langsmith_api_key: str
    langsmith_project: str

    # Oracle
    oracle_user: str = ""
    oracle_password: str = ""
    oracle_dsn: str = ""
    oracle_schema: str = ""

    # JWT
    jwt_secret_key: str = "" 
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Trend / RAG / Search
    tavily_api_key: str = ""        
    jina_api_key: str = ""
    jina_model: str = ""  
    vector_store_dir: str = "vector_store/chroma_db"  # 상대 경로 (프로젝트 루트 기준)
    vector_store_collection: str = "RAG_md"            # 기본 컬렉션 이름

    # File Server
    file_server_url: str = "https://kr.object.ncloudstorage.com/aissemble"  # 파일 서버 기본 URL

    google_client_id: str = ""  # Google Cloud Console에서 발급받은 Client ID
    google_client_secret: str = ""  # Google Cloud Console에서 발급받은 Client Secret
    google_redirect_uri: str = "http://localhost:8000/social/youtube/callback"  # 개발 환경
    
    # 프론트엔드 URL (OAuth 콜백 후 리다이렉트용)
    frontend_url: str = "http://localhost:8080"  # 프론트엔드 기본 URL
    
    # Google GenAI (로고 생성용 - Gemini 이미지 생성)
    google_genai_model: str = "gemini-2.0-flash-exp"

    # Google Cloud / Vertex AI (Veo 3.1)
    google_genai_api_key: str = ""  
    google_cloud_project: str = ""
    google_cloud_location: str = ""
    veo_model: str = ""
    veo_duration_seconds: int = 8
    veo_aspect_ratio: str = ""
    veo_resolution: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",
    )

settings = Settings()
