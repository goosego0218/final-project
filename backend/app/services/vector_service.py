# VectorStore 서비스
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: 싱글톤 함수 추가

from functools import lru_cache
from pathlib import Path

from langchain_chroma import Chroma

from app.llm.client import get_embeddings
from app.core.config import settings


@lru_cache
def get_vectorstore(
    persist_directory: str | None = None,
    collection_name: str = "collection_md",
) -> Chroma:
    """
    공통 Chroma 벡터스토어 인스턴스.
    
    Args:
        persist_directory: 벡터스토어 저장 경로 (기본값: "./chroma_db")
        collection_name: 컬렉션 이름 (기본값: "collection_md")
    
    Returns:
        Chroma 벡터스토어 인스턴스
    """
    if persist_directory is None:
        # 기본 경로는 backend/chroma_db
        base_dir = Path(__file__).resolve().parent.parent.parent
        persist_directory = str(base_dir / "chroma_db")
    
    return Chroma(
        persist_directory=persist_directory,
        embedding_function=get_embeddings(),
        collection_name=collection_name,
    )