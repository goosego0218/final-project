# 프로젝트 관련 비즈니스 로직
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-12-XX: 전략 1 적용 - relationship 제거, 명시적 join 사용

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
    # refresh 제거: commit 후 이미 obj에 grp_id 등이 설정되어 있음
    # 불필요한 relationship 로딩 방지
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
    # refresh 제거: 불필요한 relationship 로딩 방지
    
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
    # - 배열인 경우 콤마로 구분된 문자열로 변환
    if "brand_name" in profile:
        value = profile["brand_name"]
        info.brand_name = ", ".join(value) if isinstance(value, list) else str(value)
    if "category" in profile:
        value = profile["category"]
        info.category = ", ".join(value) if isinstance(value, list) else str(value)
    if "tone_mood" in profile:
        value = profile["tone_mood"]
        info.tone_mood = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "core_keywords" in profile:
        value = profile["core_keywords"]
        info.core_keywords = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "slogan" in profile:
        value = profile["slogan"]
        info.slogan = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "target_age" in profile:
        value = profile["target_age"]
        info.target_age = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "target_gender" in profile:
        value = profile["target_gender"]
        info.target_gender = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "avoided_trends" in profile:
        value = profile["avoided_trends"]
        info.avoided_trends = ", ".join(value) if isinstance(value, list) else str(value) if value else None
    if "preferred_colors" in profile:
        value = profile["preferred_colors"]
        info.preferred_colors = ", ".join(value) if isinstance(value, list) else str(value) if value else None

    db.add(info)
    db.commit()
    # refresh 제거: 불필요한 relationship 로딩 방지
    
    return group


def update_project_group(
    db: Session,
    project_id: int,
    user_id: int,
    grp_nm: str | None = None,
    grp_desc: str | None = None,
) -> ProdGroup:
    """
    프로젝트 그룹 정보 수정 (grp_nm, grp_desc).
    - 본인이 생성한 프로젝트만 수정 가능
    """
    project = load_project_group_entity(db, project_id)
    
    if project is None:
        raise ValueError(f"project_id={project_id} 프로젝트를 찾을 수 없습니다.")
    
    if project.creator_id != user_id:
        raise ValueError("본인이 생성한 프로젝트만 수정할 수 있습니다.")
    
    if project.del_yn == "Y":
        raise ValueError("이미 삭제된 프로젝트입니다.")
    
    # 프로젝트 정보 업데이트
    if grp_nm is not None:
        project.grp_nm = grp_nm
    if grp_desc is not None:
        project.grp_desc = grp_desc
    
    db.commit()
    # refresh 제거: 불필요한 relationship 로딩 방지
    
    return project