# src/brandbot/nodes/persist_project.py
import uuid
from brandbot.state import SessionState, touch_updated
from brandbot.utils.tracing import log_state
from brandbot.config import SETTINGS

async def persist_project(state: SessionState) -> SessionState:
    """
    확정 처리: project_id 부여, confirmed=True
    - DB에는 project_id만 저장
    - 전체 state는 Chroma 벡터 DB에 저장
    """
    if state.get("confirmed"):
        return {}
    
    project_id = "proj_" + uuid.uuid4().hex[:8]
    touch_updated(state)
    
    log_state(state, "persist_project:start", project_id=project_id)
    
    # DB에 project_id만 저장
    try:
        from brandbot.storage.sqlite_store import get_conn, ensure_schema, upsert_project
        
        dsn = state.get("rdb_dsn") or SETTINGS.sqlite_path
        conn = get_conn(dsn)
        ensure_schema(conn)
        
        # project_id와 name만 DB에 저장
        brand_name = state.get("brand_draft", {}).get("name")
        upsert_project(conn, project_id, brand_name)
        conn.close()
        
        log_state(state, "persist_project:db_saved", project_id=project_id, name=brand_name)
        
    except Exception as e:
        # DB 저장 실패해도 Chroma 저장은 시도
        log_state(state, "persist_project:db_error", error=type(e).__name__, message=str(e))
        pass
    
    # 전체 state는 Chroma 벡터 DB에 저장
    try:
        from brandbot.vector.indexers import save_state_to_chroma
        
        embedding_model = state.get("embedding_model") or SETTINGS.model_embed
        save_state_to_chroma(project_id, state, embedding_model)
        
        log_state(state, "persist_project:chroma_saved", 
                 project_id=project_id, 
                 embedding_model=embedding_model,
                 collection_name=f"project_state_{project_id}")
        
    except Exception as e:
        # Chroma 저장 실패해도 project_id는 부여하고 진행
        log_state(state, "persist_project:chroma_error", 
                 error=type(e).__name__, 
                 message=str(e))
        pass
    
    log_state(state, "persist_project:completed", project_id=project_id, confirmed=True)
    
    return {
        "project_id": project_id, 
        "confirmed": True,
        "vector_namespace": project_id,  # vector namespace도 project_id로 설정
    }
