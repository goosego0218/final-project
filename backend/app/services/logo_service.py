# 로고 생성물 저장 서비스
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성 (ORM 패턴 적용)

from sqlalchemy.orm import Session
from app.models.project import GenerationProd
from app.utils.file_utils import upload_base64_to_ncp, get_file_url


def save_logo_to_storage_and_db(
    db: Session,
    base64_image: str,
    project_id: int,
    prod_type_id: int,
    user_id: int,
) -> GenerationProd:
    """
    Base64 이미지를 NCP Object Storage에 업로드하고 DB에 저장
    
    Args:
        db: SQLAlchemy Session
        base64_image: Base64 인코딩된 이미지 데이터
        project_id: 프로젝트 그룹 ID
        prod_type_id: 생성물 타입 ID (PROD_TYPE 테이블)
        user_id: 사용자 ID
        
    Returns:
        GenerationProd: 생성된 엔티티
    """
    # 1. NCP Object Storage에 업로드
    file_path = upload_base64_to_ncp(
        base64_data=base64_image,
        file_type="logo",
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
        pub_yn='Y',
        create_user=user_id,
        update_user=user_id,
        del_yn='N'
    )
    
    db.add(prod)
    db.commit()
    db.refresh(prod)
    
    return prod


def get_logo_list(
    db: Session,
    project_id: int,
    prod_type_id: int = 1,  # 로고 타입
) -> list[GenerationProd]:
    """
    프로젝트의 로고 목록 조회
    """
    return (
        db.query(GenerationProd)
        .filter(
            GenerationProd.grp_id == project_id,
            GenerationProd.type_id == prod_type_id,
            GenerationProd.del_yn == 'N'
        )
        .order_by(GenerationProd.create_dt.desc())
        .all()
    )