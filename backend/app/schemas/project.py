# 프로젝트 관련 스키마
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from pydantic import BaseModel


class ProjectGrp(BaseModel):
    # 생성 시에는 클라이언트가 안 보내고, 응답에서만 채워지는 값
    grp_id: int | None = None

    grp_nm: str
    grp_desc: str | None = None

    # 요청 바디에는 안 써도 되고,
    # 응답에서는 "이 유저가 만든 프로젝트" 확인용으로 채워질 값
    creator_id: int | None = None

    class Config:
        from_attributes = True   # ORM → Pydantic 변환용

