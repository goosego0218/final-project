# 마이페이지 관련 서비스
# 작성일: 2025-12-05

from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict

from app.models.project import GenerationProd, GenerationLike, Comment
from app.utils.file_utils import get_file_url
from app.services.like_service import check_user_liked


def get_shared_items(
    db: Session,
    user_id: int,
) -> List[Dict]:
    """
    공유한 작품 조회:
    - 현재 사용자가 생성한 작품 중 pub_yn = 'Y', del_yn = 'N'인 것들
    - type_id: 1=로고, 2=숏폼
    
    Returns:
        List[Dict]: {
            "prod_id": int,
            "type": "logo" | "short",
            "file_url": str,
            "title": str | None,
            "likes": int,
            "comments": int,
            "created_at": str (ISO),
            "is_liked": bool,
        }
    """
    # 댓글 수 서브쿼리
    comment_count_subq = (
        db.query(
            Comment.prod_id,
            func.count(Comment.comment_id).label("comment_count"),
        )
        .filter(Comment.del_yn == "N")
        .group_by(Comment.prod_id)
        .subquery()
    )
    
    # 공유한 작품 조회
    rows = (
        db.query(
            GenerationProd.prod_id,
            GenerationProd.type_id,
            GenerationProd.file_path,
            GenerationProd.like_cnt,
            GenerationProd.create_dt,
            func.coalesce(comment_count_subq.c.comment_count, 0).label("comment_count"),
        )
        .outerjoin(comment_count_subq, GenerationProd.prod_id == comment_count_subq.c.prod_id)
        .filter(
            GenerationProd.create_user == user_id,
            GenerationProd.pub_yn == "Y",
            GenerationProd.del_yn == "N",
        )
        .order_by(desc(GenerationProd.create_dt))
        .all()
    )
    
    items: List[Dict] = []
    for r in rows:
        # 현재 사용자가 이 작품에 좋아요를 눌렀는지 확인
        is_liked = check_user_liked(db, r.prod_id, user_id)
        
        items.append({
            "prod_id": r.prod_id,
            "type": "logo" if r.type_id == 1 else "short",
            "file_url": get_file_url(r.file_path),
            "title": None,  # 나중에 필요하면 추가
            "likes": r.like_cnt,
            "comments": int(r.comment_count or 0),
            "created_at": r.create_dt.isoformat() if r.create_dt else None,
            "is_liked": is_liked,
        })
    
    return items


def get_liked_items(
    db: Session,
    user_id: int,
) -> List[Dict]:
    """
    좋아요한 작품 조회:
    - 현재 사용자가 좋아요를 누른 작품 중 pub_yn = 'Y', del_yn = 'N'인 것들
    - type_id: 1=로고, 2=숏폼
    
    Returns:
        List[Dict]: {
            "prod_id": int,
            "type": "logo" | "short",
            "file_url": str,
            "title": str | None,
            "likes": int,
            "comments": int,
            "created_at": str (ISO),
            "is_liked": bool,  # 항상 True (좋아요한 작품이므로)
        }
    """
    # 댓글 수 서브쿼리
    comment_count_subq = (
        db.query(
            Comment.prod_id,
            func.count(Comment.comment_id).label("comment_count"),
        )
        .filter(Comment.del_yn == "N")
        .group_by(Comment.prod_id)
        .subquery()
    )
    
    # 좋아요한 작품 조회
    rows = (
        db.query(
            GenerationProd.prod_id,
            GenerationProd.type_id,
            GenerationProd.file_path,
            GenerationProd.like_cnt,
            GenerationProd.create_dt,
            func.coalesce(comment_count_subq.c.comment_count, 0).label("comment_count"),
        )
        .join(GenerationLike, GenerationProd.prod_id == GenerationLike.prod_id)
        .outerjoin(comment_count_subq, GenerationProd.prod_id == comment_count_subq.c.prod_id)
        .filter(
            GenerationLike.user_id == user_id,
            GenerationProd.pub_yn == "Y",
            GenerationProd.del_yn == "N",
        )
        .order_by(desc(GenerationLike.create_dt))  # 좋아요 누른 순서대로
        .all()
    )
    
    items: List[Dict] = []
    for r in rows:
        # 좋아요한 작품이므로 항상 is_liked = True
        items.append({
            "prod_id": r.prod_id,
            "type": "logo" if r.type_id == 1 else "short",
            "file_url": get_file_url(r.file_path),
            "title": None,  # 나중에 필요하면 추가
            "likes": r.like_cnt,
            "comments": int(r.comment_count or 0),
            "created_at": r.create_dt.isoformat() if r.create_dt else None,
            "is_liked": True,  # 좋아요한 작품이므로 항상 True
        })
    
    return items

