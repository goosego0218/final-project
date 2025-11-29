# 갤러리 관련 서비스
# 작성일: 2025-12-XX
# 수정내역
# - 2025-12-XX: 초기 작성 - 공개된 생성물 조회 및 정렬 기능
# - 2025-12-XX: brand_info 기반 검색 기능 추가

from sqlalchemy.orm import Session
from typing import Literal, Optional
from sqlalchemy import desc, asc, func, or_

from app.models.project import GenerationProd, Comment
from app.models.brand import BrandInfo
from app.models.auth import UserInfo
from app.utils.file_utils import get_file_url


SortOption = Literal["latest", "oldest", "likes", "comments"]


def get_public_logos(
    db: Session,
    sort_by: SortOption = "latest",
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = None,
) -> list[GenerationProd]:
    """
    공개된 로고 목록 조회 (갤러리용)
    
    Args:
        db: SQLAlchemy Session
        sort_by: 정렬 옵션 ("latest", "oldest", "likes", "comments")
        skip: 건너뛸 개수 (페이지네이션)
        limit: 가져올 개수
        search_query: 검색어 (현재는 미구현, 향후 확장 가능)
        
    Returns:
        list[GenerationProd]: 공개된 로고 목록
    """
    query = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.type_id == 1,  # 로고 타입
            GenerationProd.pub_yn == 'Y',  # 공개된 것만
            GenerationProd.del_yn == 'N'  # 삭제되지 않은 것만
        )
    )
    
    # 검색어가 있으면 brand_info의 6개 컬럼에서 검색
    # (brand_name, category, tone_mood, core_keywords, slogan, preferred_colors)
    if search_query and search_query.strip():
        search_term = f"%{search_query.strip()}%"
        query = (
            query
            .join(BrandInfo, GenerationProd.grp_id == BrandInfo.grp_id)
            .filter(
                or_(
                    BrandInfo.brand_name.like(search_term),
                    BrandInfo.category.like(search_term),
                    BrandInfo.tone_mood.like(search_term),
                    BrandInfo.core_keywords.like(search_term),
                    BrandInfo.slogan.like(search_term),
                    BrandInfo.preferred_colors.like(search_term),
                )
            )
        )
    
    # 정렬 적용
    if sort_by == "latest":
        query = query.order_by(desc(GenerationProd.create_dt))
    elif sort_by == "oldest":
        query = query.order_by(asc(GenerationProd.create_dt))
    elif sort_by == "likes":
        query = query.order_by(desc(GenerationProd.like_cnt))
    elif sort_by == "comments":
        # 댓글 수로 정렬 (서브쿼리 사용)
        comment_count_subq = (
            db.query(
                Comment.prod_id,
                func.count(Comment.comment_id).label('comment_count')
            )
            .filter(
                Comment.del_yn == 'N'
            )
            .group_by(Comment.prod_id)
            .subquery()
        )
        
        query = (
            query
            .outerjoin(comment_count_subq, GenerationProd.prod_id == comment_count_subq.c.prod_id)
            .order_by(desc(func.coalesce(comment_count_subq.c.comment_count, 0)))
        )
    
    # 페이지네이션
    return query.offset(skip).limit(limit).all()


def get_public_shorts(
    db: Session,
    sort_by: SortOption = "latest",
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = None,
) -> list[GenerationProd]:
    """
    공개된 쇼츠 목록 조회 (갤러리용)
    
    Args:
        db: SQLAlchemy Session
        sort_by: 정렬 옵션 ("latest", "oldest", "likes", "comments")
        skip: 건너뛸 개수 (페이지네이션)
        limit: 가져올 개수
        search_query: 검색어 (현재는 미구현, 향후 확장 가능)
        
    Returns:
        list[GenerationProd]: 공개된 쇼츠 목록
    """
    query = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.type_id == 2,  # 쇼츠 타입
            GenerationProd.pub_yn == 'Y',  # 공개된 것만
            GenerationProd.del_yn == 'N'  # 삭제되지 않은 것만
        )
    )
    
    # 검색어가 있으면 brand_info의 6개 컬럼에서 검색
    # (brand_name, category, tone_mood, core_keywords, slogan, preferred_colors)
    if search_query and search_query.strip():
        search_term = f"%{search_query.strip()}%"
        query = (
            query
            .join(BrandInfo, GenerationProd.grp_id == BrandInfo.grp_id)
            .filter(
                or_(
                    BrandInfo.brand_name.like(search_term),
                    BrandInfo.category.like(search_term),
                    BrandInfo.tone_mood.like(search_term),
                    BrandInfo.core_keywords.like(search_term),
                    BrandInfo.slogan.like(search_term),
                    BrandInfo.preferred_colors.like(search_term),
                )
            )
        )
    
    # 정렬 적용
    if sort_by == "latest":
        query = query.order_by(desc(GenerationProd.create_dt))
    elif sort_by == "oldest":
        query = query.order_by(asc(GenerationProd.create_dt))
    elif sort_by == "likes":
        query = query.order_by(desc(GenerationProd.like_cnt))
    elif sort_by == "comments":
        # 댓글 수로 정렬 (서브쿼리 사용)
        comment_count_subq = (
            db.query(
                Comment.prod_id,
                func.count(Comment.comment_id).label('comment_count')
            )
            .filter(
                Comment.del_yn == 'N'
            )
            .group_by(Comment.prod_id)
            .subquery()
        )
        
        query = (
            query
            .outerjoin(comment_count_subq, GenerationProd.prod_id == comment_count_subq.c.prod_id)
            .order_by(desc(func.coalesce(comment_count_subq.c.comment_count, 0)))
        )
    
    # 페이지네이션
    return query.offset(skip).limit(limit).all()


def get_public_logos_count(
    db: Session,
    search_query: Optional[str] = None,
) -> int:
    """
    공개된 로고 총 개수 조회
    
    Args:
        db: SQLAlchemy Session
        search_query: 검색어 (현재는 미구현)
        
    Returns:
        int: 공개된 로고 총 개수
    """
    query = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.type_id == 1,
            GenerationProd.pub_yn == 'Y',
            GenerationProd.del_yn == 'N'
        )
    )
    
    # 검색어가 있으면 brand_info의 6개 컬럼에서 검색
    # (brand_name, category, tone_mood, core_keywords, slogan, preferred_colors)
    if search_query and search_query.strip():
        search_term = f"%{search_query.strip()}%"
        query = (
            query
            .join(BrandInfo, GenerationProd.grp_id == BrandInfo.grp_id)
            .filter(
                or_(
                    BrandInfo.brand_name.like(search_term),
                    BrandInfo.category.like(search_term),
                    BrandInfo.tone_mood.like(search_term),
                    BrandInfo.core_keywords.like(search_term),
                    BrandInfo.slogan.like(search_term),
                    BrandInfo.preferred_colors.like(search_term),
                )
            )
        )
    
    return query.count()


def get_public_shorts_count(
    db: Session,
    search_query: Optional[str] = None,
) -> int:
    """
    공개된 쇼츠 총 개수 조회
    
    Args:
        db: SQLAlchemy Session
        search_query: 검색어 (현재는 미구현)
        
    Returns:
        int: 공개된 쇼츠 총 개수
    """
    query = (
        db.query(GenerationProd)
        .filter(
            GenerationProd.type_id == 2,
            GenerationProd.pub_yn == 'Y',
            GenerationProd.del_yn == 'N'
        )
    )
    
    # 검색어가 있으면 brand_info의 6개 컬럼에서 검색
    # (brand_name, category, tone_mood, core_keywords, slogan, preferred_colors)
    if search_query and search_query.strip():
        search_term = f"%{search_query.strip()}%"
        query = (
            query
            .join(BrandInfo, GenerationProd.grp_id == BrandInfo.grp_id)
            .filter(
                or_(
                    BrandInfo.brand_name.like(search_term),
                    BrandInfo.category.like(search_term),
                    BrandInfo.tone_mood.like(search_term),
                    BrandInfo.core_keywords.like(search_term),
                    BrandInfo.slogan.like(search_term),
                    BrandInfo.preferred_colors.like(search_term),
                )
            )
        )
    
    return query.count()

