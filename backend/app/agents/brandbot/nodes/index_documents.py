# src/brandbot/nodes/index_documents.py
from brandbot.state import SessionState

async def index_documents(state: SessionState) -> SessionState:
    """
    비정형 state → 문서화 → RDB 저장(SQLite) → VectorDB 업서트(FAISS/Chroma).
    실제 I/O는 storage/vector 모듈에서 처리.
    """
    try:
        from brandbot.storage.builder import build_docs_from_state
        from brandbot.storage.sqlite_store import get_conn, ensure_schema, upsert_project, insert_documents
        from brandbot.vector.indexers import upsert_vector

        docs = build_docs_from_state(state)
        if not docs:
            return {}

        # RDB 저장
        dsn = state.get("rdb_dsn", "brandbot.db")
        conn = get_conn(dsn)
        ensure_schema(conn)
        pid = state.get("project_id") or state.get("vector_namespace")
        upsert_project(conn, pid, (state.get("brand_profile") or {}).get("name"))
        insert_documents(conn, docs)

        # Vector 업서트
        namespace = state.get("vector_namespace") or pid
        backend = state.get("vector_backend", "faiss")
        model = state.get("embedding_model", "text-embedding-3-small")
        vdocs = [
            {
                "doc_id": d["doc_id"],
                "project_id": d["project_id"],
                "kind": d["kind"],
                "text": d["text"],
                "metadata": {"source": d["source"], "chunk_index": d["chunk_index"]},
            }
            for d in docs
        ]
        upsert_vector(namespace, vdocs, backend, model)

        refs = state.get("doc_refs", [])
        refs.extend([d["doc_id"] for d in docs])
        return {"doc_refs": refs}
    except Exception as e:
        # 저장 실패는 치명적 중단 대신 에러만 남기고 진행
        return {"_error": f"index_documents_failed: {e!r}"}
