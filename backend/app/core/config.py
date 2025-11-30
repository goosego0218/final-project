from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    app_env: str = "local"
    app_name: str = "brand-ai-backend"
    app_version: str = "0.0.1"

    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-5-nano"
    fast_openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_temperature: float = 0.0

    # LangSmith
    langsmith_tracing: bool = False
    langsmith_endpoint: str = ""
    langsmith_api_key: str = ""
    langsmith_project: str = ""

    # Google GenAI
    google_genai_project: str = ""
    google_genai_location: str = ""
    google_genai_model: str = "gemini-3-pro-image-preview"
    google_genai_api_key: str = ""

    # Oracle
    oracle_user: str = ""
    oracle_password: str = ""
    oracle_dsn: str = ""
    oracle_schema: str = ""

    # JWT
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Encryption (토큰 암호화용 - AES-256-GCM)
    encryption_key: str = (
        ""  # Base64 인코딩된 32바이트(256-bit) 키 (선택적, 없으면 jwt_secret_key 기반으로 생성)
    )

    # Trend / RAG / Search
    tavily_api_key: str = ""
    jina_api_key: str = ""
    jina_model: str = ""
    vector_store_dir: str = "vector_store/chroma_db"
    vector_store_collection: str = "RAG_md"

    # File Server
    file_server_url: str = (
        "https://kr.object.ncloudstorage.com/aissemble"  # 파일 서버 기본 URL
    )

    google_client_id: str = ""  # Google Cloud Console에서 발급받은 Client ID
    google_client_secret: str = ""  # Google Cloud Console에서 발급받은 Client Secret
    google_redirect_uri: str = (
        "http://localhost:8000/social/youtube/callback"  # 개발 환경
    )

    # Facebook/Instagram OAuth 설정
    facebook_app_id: str = ""  # Facebook App ID
    facebook_app_secret: str = ""  # Facebook App Secret
    facebook_redirect_uri: str = (
        "http://localhost:8000/social/instagram/callback"  # 개발 환경
    )

    # 프론트엔드 URL (OAuth 콜백 후 리다이렉트용)
    frontend_url: str = "http://localhost:8080"  # 프론트엔드 기본 URL

    # Google Cloud / Vertex AI (Veo 3.1)
    google_cloud_project: str = ""
    google_cloud_location: str = ""
    veo_model: str = ""
    veo_duration_seconds: int = 8
    veo_aspect_ratio: str = ""
    veo_resolution: str = ""

    # NCP Object Storage
    ncp_access_key: str = ""
    ncp_secret_key: str = ""
    ncp_region: str = ""
    ncp_endpoint: str = ""
    ncp_bucket_name: str = ""

    # Kanana Safeguard (가드레일)
    safeguard_enabled: bool = False
    safeguard_server_url: str = ""  # GPU 서버 URL (예: "http://gpu-server:8001")

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
