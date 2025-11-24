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

def get_user_projects(
    db: Session,
    user_id: int,
) -> list[ProdGroup]:
    """
    특정 사용자가 생성한 프로젝트 목록 조회.
    - del_yn = 'N'인 것만 조회
    - grp_id 내림차순 정렬 (최신순)
    """
    return (
        db.query(ProdGroup)
        .filter(
            ProdGroup.creator_id == user_id,
            ProdGroup.del_yn == "N",
        )
        .order_by(ProdGroup.grp_id.desc())
        .all()
    )


def delete_project_group(
    db: Session,
    project_id: int,
    user_id: int,
) -> ProdGroup:
    """
    프로젝트 그룹 소프트 삭제 (del_yn을 'Y'로 변경).
    - 본인이 생성한 프로젝트만 삭제 가능
    """
    project = load_project_group_entity(db, project_id)
    
    if project is None:
        raise ValueError(f"project_id={project_id} 프로젝트를 찾을 수 없습니다.")
    
    if project.creator_id != user_id:
        raise ValueError("본인이 생성한 프로젝트만 삭제할 수 있습니다.")
    
    if project.del_yn == "Y":
        raise ValueError("이미 삭제된 프로젝트입니다.")
    
    # del_yn을 'Y'로 변경
    project.del_yn = "Y"
    db.commit()
    db.refresh(project)
    
    return project


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

    # 혹시나 브랜드명 없으면 프로젝트 그룹명으로 넣기
    if "brand_name" not in profile and group.grp_nm:
        profile["brand_name"] = group.grp_nm        

    return profile


def persist_brand_project(
    db: Session,
    *,
    creator_id: int,
    project_id: int | None,
    project_draft: dict | None,
    brand_profile: BrandProfile | dict | None,
) -> ProdGroup | None:
    """
    브랜드 그래프에서 생성한 persist_request 를 받아
    - 프로젝트 그룹(prod_grp)을 생성하거나(없으면)
    - 브랜드 상세 정보(brand_info)를 upsert 한 뒤
    최종 ProdGroup 엔티티를 반환한다.

    저장할 정보가 충분치 않으면 아무 것도 하지 않고 None 을 반환한다.
    """
    draft: dict = dict(project_draft or {})
    profile: dict = dict(brand_profile or {})

    group: ProdGroup | None = None

    # 1) project_id 가 이미 있으면 해당 프로젝트 그룹을 조회
    if project_id is not None:
        group = load_project_group_entity(db, project_id)
        if group is None:
            # 존재하지 않는 project_id 이면 저장하지 않고 종료
            return None
    else:
        # 2) project_id 가 없으면, grp_nm 을 기준으로 새 프로젝트 그룹 생성
        grp_nm = draft.get("grp_nm")
        if not grp_nm:
            # 프로젝트 이름조차 없으면 생성할 수 없음
            return None

        payload = ProjectGrp(
            grp_id=None,
            grp_nm=grp_nm,
            grp_desc=draft.get("grp_desc"),
            creator_id=creator_id,
        )
        group = create_project_group(db, payload, creator_id=creator_id)
        project_id = group.grp_id

    # 3) 브랜드 정보 upsert (brand_info)
    info = load_brand_info_entity(db, project_id)
    if info is None:
        info = BrandInfo(grp_id=project_id)

    # BrandProfile 스키마에 맞춰 필드 매핑
    # - profile 에 해당 키가 있으면 그대로 덮어쓴다.
    if "brand_name" in profile:
        info.brand_name = profile["brand_name"]
    if "category" in profile:
        info.category = profile["category"]
    if "tone_mood" in profile:
        info.tone_mood = profile["tone_mood"]
    if "core_keywords" in profile:
        info.core_keywords = profile["core_keywords"]
    if "slogan" in profile:
        info.slogan = profile["slogan"]
    if "target_age" in profile:
        info.target_age = profile["target_age"]
    if "target_gender" in profile:
        info.target_gender = profile["target_gender"]
    if "avoided_trends" in profile:
        info.avoided_trends = profile["avoided_trends"]
    if "preferred_colors" in profile:
        info.preferred_colors = profile["preferred_colors"]

    db.add(info)
    db.commit()
    db.refresh(group)

    return group