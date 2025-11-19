# 프로젝트 관련 비즈니스 로직
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from sqlalchemy.orm import Session

from app.models.project import ProdGroup
from app.models.brand import BrandInfo
from app.schemas.project import ProjectGrp
from app.agents.state import BrandProfile


def create_project_group(
    db: Session,
    payload: ProjectGrp,
    creator_id: int,
) -> ProdGroup:
    """
    prod_grp 에 새로운 프로젝트 그룹 한 줄 INSERT.
    creator_id 는 항상 로그인한 사용자 ID 로 세팅.
    """
    obj = ProdGroup(
        grp_nm=payload.grp_nm,
        grp_desc=payload.grp_desc,
        creator_id=creator_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def load_project_group_entity(
    db: Session,
    project_id: int,
) -> ProdGroup | None:
    """
    prod_grp 엔티티 한 줄을 조회한다.
    """
    return (
        db.query(ProdGroup)
        .filter(ProdGroup.grp_id == project_id)
        .first()
    )

def load_brand_info_entity(
    db: Session,
    project_id: int,
) -> BrandInfo | None:
    """
    brand_info 엔티티 한 줄을 조회한다.
    - brand_info가 아직 생성되지 않았을 수도 있으므로 None 허용.
    """
    return (
        db.query(BrandInfo)
        .filter(BrandInfo.grp_id == project_id)
        .first()
    )

def load_brand_profile_for_agent(
    db: Session,
    project_id: int,
) -> BrandProfile:
    """
    로고/숏폼 에이전트에서 사용하기 위한 브랜드 프로필을 로딩한다.

    - prod_grp (프로젝트 기본정보)
    - brand_info (브랜드 상세 정보)
    두 테이블을 조합해서 BrandProfile TypedDict 형태로 반환한다.

    BrandProfile 필드:
        brand_name, category, tone_mood, core_keywords,
        slogan, target_age, target_gender,
        avoided_trends, preferred_colors
    """
    group = load_project_group_entity(db, project_id)
    if group is None:
        raise ValueError(f"project_id={project_id} 프로젝트를 찾을 수 없습니다.")

    info = load_brand_info_entity(db, project_id)

    profile: BrandProfile = {}

    if info:
        if info.brand_name:
            profile["brand_name"] = info.brand_name
        if info.category:
            profile["category"] = info.category
        if info.tone_mood:
            profile["tone_mood"] = info.tone_mood
        if info.core_keywords:
            profile["core_keywords"] = info.core_keywords
        if info.slogan:
            profile["slogan"] = info.slogan
        if info.target_age:
            profile["target_age"] = info.target_age
        if info.target_gender:
            profile["target_gender"] = info.target_gender
        if info.avoided_trends:
            profile["avoided_trends"] = info.avoided_trends
        if info.preferred_colors:
            profile["preferred_colors"] = info.preferred_colors

    if "brand_name" not in profile and group.grp_nm:
        profile["brand_name"] = group.grp_nm        

    return profile