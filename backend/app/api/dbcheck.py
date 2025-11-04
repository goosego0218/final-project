from fastapi import APIRouter, Depends
from app.db.session import get_db_session

router = APIRouter(prefix="/db", tags=["db"])

@router.get("/ping")
def db_ping(conn=Depends(get_db_session)):
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM DUAL")
        row = cur.fetchone()
        return {"status": "ok", "db_result": row[0] if row else None}
    except Exception as e:
        return {"status": "error", "error": str(e)}
