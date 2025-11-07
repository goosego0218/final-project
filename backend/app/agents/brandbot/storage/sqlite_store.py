# src/brandbot/storage/sqlite_store.py
import sqlite3
from typing import Optional
from datetime import datetime

def get_conn(dsn: str = "brandbot.db") -> sqlite3.Connection:
    """SQLite 연결 반환"""
    conn = sqlite3.connect(dsn, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_schema(conn: sqlite3.Connection) -> None:
    """스키마 초기화"""
    try:
        # schema.sql의 CREATE TABLE을 실행
        with open("schema.sql", "r", encoding="utf-8") as f:
            sql = f.read()
            # CREATE TABLE 부분만 추출
            conn.executescript(sql)
    except Exception:
        # 파일이 없으면 직접 실행
        conn.execute("""
            CREATE TABLE IF NOT EXISTS project (
                project_id TEXT PRIMARY KEY,
                name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

def upsert_project(conn: sqlite3.Connection, project_id: str, name: Optional[str] = None) -> None:
    """프로젝트 메타데이터 업서트 (project_id와 name만 저장)"""
    ensure_schema(conn)
    now = datetime.utcnow().isoformat() + "Z"
    
    conn.execute("""
        INSERT INTO project (project_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
            name = COALESCE(excluded.name, name),
            updated_at = excluded.updated_at
    """, (project_id, name, now, now))
    conn.commit()

def insert_documents(conn: sqlite3.Connection, docs: list) -> None:
    """문서 삽입 (기존 함수 호환)"""
    # 실제 구현은 index_documents에서 사용하는 형태에 맞춰야 함
    pass
