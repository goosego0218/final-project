from pathlib import Path
import os

from dotenv import load_dotenv

from app.core.config import settings


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _env_or_fallback(key: str, fallback: str | None) -> str | None:
    """
    Return existing env var when available, otherwise fall back to the Settings
    default and ensure downstream libraries see the same value via os.environ.
    """
    value = os.getenv(key)
    if value:
        return value
    if fallback:
        os.environ[key] = fallback
    return fallback


IDEOGRAM_API_KEY = _env_or_fallback("IDEOGRAM_API_KEY", settings.ideogram_api_key)
OPENAI_API_KEY = _env_or_fallback("OPENAI_API_KEY", settings.openai_api_key)
GOOGLE_API_KEY = _env_or_fallback("GOOGLE_API_KEY", None)
LANGCHAIN_API_KEY = _env_or_fallback("LANGCHAIN_API_KEY", settings.langchain_api_key)
_langsmith_project_env = os.getenv("LANGSMITH_PROJECT")
LANGCHAIN_PROJECT = _env_or_fallback(
    "LANGCHAIN_PROJECT", settings.langchain_project or _langsmith_project_env
)
LANGSMITH_PROJECT = _env_or_fallback(
    "LANGSMITH_PROJECT", _langsmith_project_env or LANGCHAIN_PROJECT
)
LANGCHAIN_ENDPOINT = os.getenv("LANGCHAIN_ENDPOINT")

# Automatically enable LangSmith tracing when credentials are present.
if LANGCHAIN_API_KEY and not os.getenv("LANGCHAIN_TRACING_V2"):
    os.environ["LANGCHAIN_TRACING_V2"] = "true"

SAVE_DIR = Path("data/outputs")
FONT_DIR = Path("fonts")

SAVE_DIR.mkdir(parents=True, exist_ok=True)
FONT_DIR.mkdir(parents=True, exist_ok=True)
