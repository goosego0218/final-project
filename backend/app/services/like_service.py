# 좋아요 관련 서비스
# 작성일: 2025-11-29
# 수정내역
# - 2025-11-29: 초기 작성
# - 2025-12-XX: 전략 1 적용 - relationship 제거, 명시적 join 사용

from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy import and_

from app.models.project import GenerationLike, GenerationProd
from app.models.auth import UserInfo


def toggle_like(
    db: Session,
    prod_id: int,
    user_id: int,
) -> dict:
    """
    좋아요 토글 (좋아요 추가/취소)
    - 이미 좋아요가 있으면 취소 (DELETE)
    - 없으면 추가 (INSERT)
    - 트리거로 generation_prod.like_cnt 자동 업데이트
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        user_id: 유저 번호
        
    Returns:
        dict: {
            "is_liked": bool,  # 현재 좋아요 상태
            "like_count": int  # 업데이트된 좋아요 개수
        }
        
    Raises:
        ValueError: 생성물이 없거나 삭제된 경우
    """
    # 생성물 존재 확인
    product = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.prod_id == prod_id,
            GenerationProd.del_yn == 'N',
        )
        .first()
    )
    
    if not product:
        raise ValueError("생성물을 찾을 수 없습니다.")
    
    # 기존 좋아요 확인
    existing_like = (
        db.query(GenerationLike)
        .filter(
            and_(
                GenerationLike.prod_id == prod_id,
                GenerationLike.user_id == user_id,
            )
        )
        .first()
    )
    
    if existing_like:
        # 좋아요 취소 (DELETE)
        try:
            db.delete(existing_like)
            db.flush()  # flush로 DB에 반영 (트리거 실행)
            db.commit()
            
            # 트리거로 like_cnt가 자동 감소되므로 다시 조회
            db.refresh(product)
            
            return {
                "is_liked": False,
                "like_count": product.like_cnt,
            }
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 좋아요 취소 실패: {e}")
            raise ValueError(f"좋아요 취소에 실패했습니다: {str(e)}")
    else:
        # 좋아요 추가 (INSERT)
        try:
            new_like = GenerationLike(
                prod_id=prod_id,
                user_id=user_id,
            )
            db.add(new_like)
            db.flush()  # flush로 DB에 반영 (트리거 실행)
            db.commit()
            
            # 트리거로 like_cnt가 자동 증가되므로 다시 조회
            db.refresh(product)
            
            return {
                "is_liked": True,
                "like_count": product.like_cnt,
            }
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 좋아요 추가 실패: {e}")
            raise ValueError(f"좋아요 추가에 실패했습니다: {str(e)}")


def check_user_liked(
    db: Session,
    prod_id: int,
    user_id: int,
) -> bool:
    """
    특정 유저가 특정 생성물에 좋아요를 눌렀는지 확인
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        user_id: 유저 번호
        
    Returns:
        bool: 좋아요 여부
    """
    like = (
        db.query(GenerationLike)
        .filter(
            and_(
                GenerationLike.prod_id == prod_id,
                GenerationLike.user_id == user_id,
            )
        )
        .first()
    )
    
    return like is not None


def get_like_count(
    db: Session,
    prod_id: int,
) -> int:
    """
    생성물의 좋아요 개수 조회
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        
    Returns:
        int: 좋아요 개수
    """
    product = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.prod_id == prod_id,
            GenerationProd.del_yn == 'N',
        )
        .first()
    )
    
    if not product:
        return 0
    
    return product.like_cnt

