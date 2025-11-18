# ORM 세션 생성
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session

from app.core.config import settings

DATABASE_URL = f"oracle+oracledb://{settings.oracle_user}:{settings.oracle_password}@{settings.oracle_dsn}"

# 모든 ORM 모델이 상속할 Base 클래스
class Base(DeclarativeBase):
    """
    SQLAlchemy Declarative Base
    - app.models.* 에서 Base를 상속해서 테이블 정의에 사용
    """
    pass

# 엔진 생성
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True, # 죽은 커넥션 자동 감지
    future=True, # SQLAlchemy 2.x 스타일
)

# 세션 팩토리
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

# Fast API 의존성
def get_orm_session() -> Generator[Session, None, None]:
    """
    FastAPI 의존성용 ORM 세션.
    - 라우터/서비스에서 Depends(get_orm_session)으로 주입해서 사용.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()