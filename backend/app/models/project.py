# 프로젝트 관련 모델
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from __future__ import annotations

from sqlalchemy import Column, Integer, String, text
from app.db.orm import Base


class ProdGroup(Base):
    """
    생성물 프로젝트 그룹 (prod_grp)

    - grp_id   : 프로젝트 그룹 ID (PK)
    - grp_nm   : 그룹명 (사용자가 입력)
    - grp_desc : 그룹 설명
    - del_yn   : 삭제 여부 (기본 'N')
    """
    __tablename__ = "prod_grp"

    grp_id = Column(Integer, primary_key=True, index=True)
    grp_nm = Column(String(200), nullable=False)
    grp_desc = Column(String(1000), nullable=True)

    # Oracle 컬럼: DEL_YN CHAR(1) or VARCHAR2(1)
    # DB 기본값이 'N'으로 잡혀있으면 server_default만 지정해도 됨
    del_yn = Column(String(1), nullable=False, server_default=text("'N'"))
