# 댓글 관련 서비스
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.models.project import Comment, GenerationProd
from app.models.auth import UserInfo


def create_comment(
    db: Session,
    prod_id: int,
    user_id: int,
    content: str,
) -> Comment:
    """
    댓글 생성
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        user_id: 작성자 유저 번호
        content: 댓글 내용
        
    Returns:
        Comment: 생성된 댓글
        
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
    
    # 댓글 생성
    comment = Comment(
        prod_id=prod_id,
        user_id=user_id,
        content=content,
        del_yn='N',
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return comment


def get_comments_by_prod_id(
    db: Session,
    prod_id: int,
    skip: int = 0,
    limit: int = 100,
) -> list[Comment]:
    """
    생성물의 댓글 목록 조회 (최신순)
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        skip: 건너뛸 개수
        limit: 최대 개수
        
    Returns:
        list[Comment]: 댓글 목록
    """
    return (
        db.query(Comment)
        .filter(
            Comment.prod_id == prod_id,
            Comment.del_yn == 'N',
        )
        .order_by(Comment.create_dt.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def delete_comment(
    db: Session,
    comment_id: int,
    user_id: int,
) -> bool:
    """
    댓글 삭제 (소프트 삭제)
    
    Args:
        db: SQLAlchemy Session
        comment_id: 댓글 번호
        user_id: 요청한 유저 번호 (본인만 삭제 가능)
        
    Returns:
        bool: 삭제 성공 여부
        
    Raises:
        ValueError: 댓글이 없거나 권한이 없는 경우
    """
    comment = (
        db.query(Comment)
        .filter(
            Comment.comment_id == comment_id,
            Comment.del_yn == 'N',
        )
        .first()
    )
    
    if not comment:
        raise ValueError("댓글을 찾을 수 없습니다.")
    
    # 본인만 삭제 가능
    if comment.user_id != user_id:
        raise ValueError("댓글을 삭제할 권한이 없습니다.")
    
    # 소프트 삭제
    comment.del_yn = 'Y'
    db.commit()
    
    return True


def get_comment_count_by_prod_id(
    db: Session,
    prod_id: int,
) -> int:
    """
    생성물의 댓글 개수 조회
    
    Args:
        db: SQLAlchemy Session
        prod_id: 생성물 번호
        
    Returns:
        int: 댓글 개수
    """
    from sqlalchemy import func
    
    return (
        db.query(func.count(Comment.comment_id))
        .filter(
            Comment.prod_id == prod_id,
            Comment.del_yn == 'N',
        )
        .scalar() or 0
    )