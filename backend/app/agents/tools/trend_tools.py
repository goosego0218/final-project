# RAG + Tavily + Jina Reranker 도구 모음 (서브에이전트용)
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: 로직 수정

from __future__ import annotations

from typing import List

import logging

from langchain_core.tools import tool
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_community.document_compressors import JinaRerank

from app.core.config import settings
from app.llm.client import get_embeddings

logger = logging.getLogger(__name__)

# 최근 검색 문서 캐시 (Rerank용)
_last_docs: List[Document] = []


def _get_vectorstore() -> Chroma:
    """
    트렌드 RAG용 Chroma 벡터스토어 생성/획득.
    - 실제로는 초기화/인덱싱 코드를 따로 두는 게 좋지만
      지금은 agent 테스트용으로 간단히 구성합니다.
    """
    embeddings = get_embeddings()
    # 추후 경로나 컬렉션 이름은 settings로 빼도 됨
    return Chroma(
        collection_name="trend_rag",
        embedding_function=embeddings,
        persist_directory="storage/chroma/trend_rag",
    )


@tool("rag_search_tool", return_direct=False)
def rag_search_tool(query: str) -> str:
    """
    내부 트렌드/마케팅 자료를 우선 검색하는 도구입니다.

    - vector store: trend_rag (Chroma)
    - 사용 시점:
      1. 사용자의 질문을 그대로 RAG 검색
      2. 검색된 문서들을 _last_docs에 캐시
      3. LLM이 이를 바탕으로 1차 답변을 구성하거나,
         필요시 추가 도구(tavily_web_search_tool, apply_reranker_tool)를 호출할 수 있습니다.
    """
    global _last_docs

    logger.info("[도구:rag_search_tool] 쿼리: %s", query)

    vs = _get_vectorstore()
    docs = vs.similarity_search(query, k=8)
    _last_docs = docs

    if not docs:
        return "RAG 검색 결과가 없습니다. 필요한 경우 tavily_web_search_tool을 사용해 주세요."

    blocks: List[str] = []
    for idx, doc in enumerate(docs, start=1):
        meta = doc.metadata or {}
        title = meta.get("title", "")
        header = f"[RAG {idx}] {title}" if title else f"[RAG {idx}]"
        blocks.append(f"{header}\n{doc.page_content}")

    return "\n\n---\n\n".join(blocks)


@tool("tavily_web_search_tool", return_direct=False)
def tavily_web_search_tool(query: str) -> str:
    """
    웹 트렌드 보완 검색 도구입니다.

    사용 규칙:
    - 내부 RAG 검색 결과가 부족할 때만 사용하세요.
    - 최신 트렌드, 통계, 사례 등이 필요할 때 유용합니다.
    """
    global _last_docs

    if not settings.tavily_api_key:
        logger.warning("[도구:tavily_web_search_tool] Tavily API Key가 설정되어 있지 않습니다.")
        return "Tavily API Key가 설정되지 않아 웹 검색을 사용할 수 없습니다."

    logger.info("[도구:tavily_web_search_tool] 쿼리: %s", query)

    tavily = TavilySearchResults(
        api_key=settings.tavily_api_key,
        max_results=5,
    )
    results = tavily.invoke({"query": query})

    docs: List[Document] = []
    blocks: List[str] = []

    for idx, item in enumerate(results, start=1):
        title = item.get("title") or ""
        url = item.get("url") or ""
        content = item.get("content") or ""

        meta = {
            "source": "TAVILY",
            "title": title,
            "url": url,
        }
        doc = Document(page_content=content, metadata=meta)
        docs.append(doc)

        header = f"[WEB {idx}] {title}".strip() or f"[WEB {idx}]"
        block_lines = [header]
        if url:
            block_lines.append(f"URL: {url}")
        block_lines.append(content)
        blocks.append("\n".join(block_lines))

    # 기존 RAG 결과에 웹 결과를 추가
    _last_docs.extend(docs)

    if not docs:
        return "웹 검색 결과가 없습니다."

    return "\n\n---\n\n".join(blocks)


@tool("apply_reranker_tool", return_direct=False)
def apply_reranker_tool(query: str) -> str:
    """
    Jina Rerank를 사용해 RAG + 웹 검색 결과를 재정렬하는 도구입니다.

    사용 규칙:
    - rag_search_tool, tavily_web_search_tool 사용 이후에 호출
    - _last_docs에 쌓여 있는 문서를 대상으로 재정렬
    - 최종 답변 생성 전 마지막 단계로 사용하는 것이 좋습니다.
    """
    global _last_docs

    logger.info("[도구:apply_reranker_tool] 재정렬 대상 문서 수: %d", len(_last_docs))

    if not _last_docs:
        return "Reranker 결과: 재정렬할 문서가 없습니다. 먼저 rag_search_tool 또는 tavily_web_search_tool을 사용하세요."

    if not settings.jina_api_key:
        logger.error("[도구:apply_reranker_tool] Jina API Key가 설정되어 있지 않습니다.")
        return "Jina API Key가 설정되지 않아 Reranker를 사용할 수 없습니다."

    compressor = JinaRerank(
        jina_api_key=settings.jina_api_key,
        model="jina-reranker-v2-base-multilingual",
        top_n=5,
    )

    docs = compressor.compress_documents(
        documents=_last_docs,
        query=query,
    )

    logger.info("[도구:apply_reranker_tool] Rerank 완료: %d → %d", len(_last_docs), len(docs))

    blocks: List[str] = []
    for idx, doc in enumerate(docs, start=1):
        meta = doc.metadata or {}
        source = (meta.get("source") or "RAG").upper()
        title = meta.get("title") or ""

        header = f"[RERANKED {idx}] {source}"
        if title:
            header += f": {title}"

        block_lines = [header]

        if source == "TAVILY" and meta.get("url"):
            block_lines.append(f"URL: {meta.get('url')}")

        block_lines.append(doc.page_content)
        blocks.append("\n".join(block_lines))

    return "\n\n---\n\n".join(blocks)


TOOLS = [
    rag_search_tool,
    tavily_web_search_tool,
    apply_reranker_tool,
]