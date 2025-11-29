from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.db.orm import Base

class BrandInfo(Base):
    """
    브랜드 상세 정보 테이블 (brand_info)
    - prod_grp와 1:1 관계 (grp_id가 PK이자 FK)
    """

    __tablename__ = "brand_info"

    grp_id = Column(
        Integer,
        ForeignKey("prod_grp.grp_id"),
        primary_key=True,
        index=True,
    )

    brand_name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)

    tone_mood = Column(String(255), nullable=True)
    core_keywords = Column(String(1000), nullable=True)
    slogan = Column(String(500), nullable=True)
    target_age = Column(String(100), nullable=True)
    target_gender = Column(String(50), nullable=True)
    avoided_trends = Column(String(1000), nullable=True)
    preferred_colors = Column(String(500), nullable=True)

    create_dt = Column(DateTime, server_default=func.sysdate(), nullable=False)
    update_dt = Column(
        DateTime,
        server_default=func.sysdate(),
        onupdate=func.sysdate(),
        nullable=False,
    )