# DB 세션 관리 - Oracle
# 작성자: 황민준
# 작성일: 2025-10-28
# 수정내역
# - 2025-10-28: 초기 작성

import oracledb
import logging
from pathlib import Path
from typing import Generator, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# Instant Client 경로 자동 탐색
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CLIENT_DIR = BASE_DIR / "instantclient_19_28"

try:
    if CLIENT_DIR.exists():
        oracledb.init_oracle_client(lib_dir=str(CLIENT_DIR))
        logger.info(f"Oracle client initialized from: {CLIENT_DIR}")
    else:
        logger.warning(f"Instant Client folder not found at: {CLIENT_DIR}")
except Exception as e:
    logger.warning(f"Oracle client already initialized or not found: {e}")


class OracleDB:
    def __init__(self):
        self._pool: Optional[oracledb.ConnectionPool] = None

    def init_pool(self):
        if self._pool is not None:
            return
        try:
            self._pool = oracledb.create_pool(
                user=settings.oracle_user,
                password=settings.oracle_password,
                dsn=settings.oracle_dsn,
                min=2,  # 최소 커넥션 (1 → 2)
                max=20,  # 최대 커넥션 (4 → 20)
                increment=2,  # 증가 단위 (1 → 2)
                timeout=30,  # 커넥션 대기 시간 (초)
                max_lifetime_session=3600,  # 세션 최대 수명 (초)
            )
            logger.info("Oracle connection pool initialized successfully")
        except Exception as e:
            logger.exception("Failed to initialize Oracle connection pool")
            raise e

    def get_connection(self) -> oracledb.Connection:
        if self._pool is None:
            raise RuntimeError("Oracle connection pool is not initialized")
        return self._pool.acquire()
    
    def close_pool(self):
        if self._pool:
            self._pool.close()

oracle_db = OracleDB()

def get_db_session() -> Generator[oracledb.Connection, None, None]:
    conn = oracle_db.get_connection()
    try:
        yield conn
    finally:
        conn.close()
