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
client_dir_override = (
    Path(settings.oracle_client_dir) if settings.oracle_client_dir else CLIENT_DIR
)

# Default to thin mode; optionally initialize thick mode when explicitly requested.
if settings.oracle_use_thick:
    if client_dir_override.exists():
        try:
            oracledb.init_oracle_client(lib_dir=str(client_dir_override))
            logger.info(f"Oracle client initialized from: {client_dir_override}")
        except Exception as e:
            logger.warning(
                f"Oracle thick client init failed, falling back to thin mode: {e}"
            )
    else:
        logger.warning(
            f"Thick mode requested but Instant Client folder not found at: {client_dir_override}"
        )
else:
    logger.info("Oracle thin mode in use (no Instant Client initialization)")


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
                min=1,
                max=4,
                increment=1,
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
