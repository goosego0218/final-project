# DB 연결 테스트
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성


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
