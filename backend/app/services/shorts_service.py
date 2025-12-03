# 쇼츠 생성물 저장 서비스
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성 (ORM 패턴 적용)
# - 2025-11-29: 전략 1 적용 - relationship 제거

from sqlalchemy.orm import Session
from app.models.project import GenerationProd, ProdGroup
from app.utils.file_utils import upload_base64_to_ncp, get_file_url


def save_shorts_to_storage_and_db(
    db: Session,
    base64_video: str,
    project_id: int,
    prod_type_id: int,
    user_id: int,
) -> GenerationProd:
    """
    Base64 비디오를 NCP Object Storage에 업로드하고 DB에 저장
    
    Args:
        db: SQLAlchemy Session
        base64_video: Base64 인코딩된 비디오 데이터
        project_id: 프로젝트 그룹 ID
        prod_type_id: 생성물 타입 ID (PROD_TYPE 테이블)
        user_id: 사용자 ID
        
    Returns:
        GenerationProd: 생성된 엔티티
    """
    # 1. NCP Object Storage에 업로드
    file_path = upload_base64_to_ncp(
        base64_data=base64_video,
        file_type="shorts",
        project_id=project_id
    )
    
    # 2. ORM으로 DB에 저장
    prod = GenerationProd(
        type_id=prod_type_id,
        grp_id=project_id,
        file_path=file_path,
        view_cnt=0,
        ref_cnt=0,
        like_cnt=0,
        create_user=user_id,
        update_user=user_id,
        del_yn='N'
    )
    
    db.add(prod)
    db.commit()
    db.refresh(prod)
    
    return prod


def get_shorts_list(
    db: Session,
    project_id: int,
    prod_type_id: int = 2,  # 쇼츠 타입
) -> list[GenerationProd]:
    """
    프로젝트의 쇼츠 목록 조회
    - 프로젝트가 삭제되지 않은 경우만 조회
    """
    return (
        db.query(GenerationProd)
        .join(ProdGroup, GenerationProd.grp_id == ProdGroup.grp_id)
        .filter(
            GenerationProd.grp_id == project_id,
            GenerationProd.type_id == prod_type_id,
            GenerationProd.del_yn == 'N',
            ProdGroup.del_yn == 'N'  # 프로젝트가 삭제되지 않은 것만
        )
        .order_by(GenerationProd.create_dt.desc())
        .all()
    )


def delete_shorts(
    db: Session,
    prod_id: int,
    user_id: int,
) -> bool:
    """
    쇼츠 삭제 (소프트 삭제)
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 ID
        user_id: 사용자 ID (권한 확인용)
        
    Returns:
        bool: 삭제 성공 여부
        
    Raises:
        ValueError: 쇼츠를 찾을 수 없거나 권한이 없는 경우
    """
    prod = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.prod_id == prod_id,
            GenerationProd.del_yn == 'N'
        )
        .first()
    )
    
    if not prod:
        raise ValueError("쇼츠를 찾을 수 없습니다.")
    
    # 본인이 생성한 쇼츠인지 확인
    if prod.create_user != user_id:
        raise ValueError("삭제 권한이 없습니다.")
    
    # 소프트 삭제
    prod.del_yn = 'Y'
    db.commit()
    
    return True


def update_shorts_pub_yn(
    db: Session,
    prod_id: int,
    pub_yn: str,
    user_id: int,
) -> GenerationProd:
    """
    쇼츠 공개 여부 업데이트 (PUB_YN)
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 ID
        pub_yn: 공개 여부 ('Y' 또는 'N')
        user_id: 사용자 ID (권한 확인용)
        
    Returns:
        GenerationProd: 업데이트된 엔티티
        
    Raises:
        ValueError: 쇼츠를 찾을 수 없거나 권한이 없는 경우, 또는 pub_yn 값이 잘못된 경우
    """
    if pub_yn not in ('Y', 'N'):
        raise ValueError("pub_yn은 'Y' 또는 'N'이어야 합니다.")
    
    prod = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.prod_id == prod_id,
            GenerationProd.del_yn == 'N'
        )
        .first()
    )
    
    if not prod:
        raise ValueError("쇼츠를 찾을 수 없습니다.")
    
    # 본인이 생성한 쇼츠인지 확인
    if prod.create_user != user_id:
        raise ValueError("수정 권한이 없습니다.")
    
    # 공개 여부 업데이트
    prod.pub_yn = pub_yn
    db.commit()
    db.refresh(prod)
    
    return prod

