# 갤러리 관련 엔드포인트
# 작성일: 2025-11-29
# 수정내역
# - 2025-11-29: 초기 작성

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Literal, Optional

from app.db.orm import get_orm_session
from app.core.deps import get_optional_user
from app.models.auth import UserInfo
from app.schemas.gallery import GalleryListResponse, GalleryItemResponse
from app.services.gallery_service import (
    get_public_logos,
    get_public_shorts,
    get_public_logos_count,
    get_public_shorts_count,
)
from app.services.comment_service import get_comment_count_by_prod_id
from app.services.like_service import check_user_liked
from app.utils.file_utils import get_file_url

router = APIRouter(
    prefix="/gallery",
    tags=["gallery"],
)

SortOption = Literal["latest", "oldest", "likes", "comments"]


@router.get("/logos", response_model=GalleryListResponse, summary="로고 갤러리 조회")
def get_logo_gallery(
    sort_by: SortOption = Query("latest", description="정렬 옵션: latest, oldest, likes, comments"),
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 개수"),
    search_query: Optional[str] = Query(None, description="검색어 (향후 구현)"),
    db: Session = Depends(get_orm_session),
    current_user: Optional[UserInfo] = Depends(get_optional_user),
):
    """
    공개된 로고 갤러리 조회
    - 로그인 여부와 관계없이 조회 가능
    - 정렬 옵션: latest(최신순), oldest(오래된순), likes(좋아요순), comments(댓글순)
    """
    # 공개된 로고 목록 조회
    logos = get_public_logos(
        db=db,
        sort_by=sort_by,
        skip=skip,
        limit=limit,
        search_query=search_query,
    )
    
    # 총 개수 조회
    total_count = get_public_logos_count(db=db, search_query=search_query)
    
    # 응답 형식으로 변환
    items = []
    for logo in logos:
        # 댓글 수 조회
        comment_count = get_comment_count_by_prod_id(db, logo.prod_id)
        
        # 좋아요 상태 확인 (로그인한 경우에만)
        is_liked = False
        if current_user:
            is_liked = check_user_liked(db, logo.prod_id, current_user.id)
        
        items.append(GalleryItemResponse(
            prod_id=logo.prod_id,
            file_url=get_file_url(logo.file_path),
            like_count=logo.like_cnt,
            comment_count=comment_count,
            create_dt=logo.create_dt,
            is_liked=is_liked,
        ))
    
    return GalleryListResponse(
        items=items,
        total_count=total_count,
        skip=skip,
        limit=limit,
    )


@router.get("/shorts", response_model=GalleryListResponse, summary="쇼츠 갤러리 조회")
def get_shorts_gallery(
    sort_by: SortOption = Query("latest", description="정렬 옵션: latest, oldest, likes, comments"),
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 개수"),
    search_query: Optional[str] = Query(None, description="검색어 (향후 구현)"),
    db: Session = Depends(get_orm_session),
    current_user: Optional[UserInfo] = Depends(get_optional_user),
):
    """
    공개된 쇼츠 갤러리 조회
    - 로그인 여부와 관계없이 조회 가능
    - 정렬 옵션: latest(최신순), oldest(오래된순), likes(좋아요순), comments(댓글순)
    """
    # 공개된 쇼츠 목록 조회
    shorts = get_public_shorts(
        db=db,
        sort_by=sort_by,
        skip=skip,
        limit=limit,
        search_query=search_query,
    )
    
    # 총 개수 조회
    total_count = get_public_shorts_count(db=db, search_query=search_query)
    
    # 응답 형식으로 변환
    items = []
    for short in shorts:
        # 댓글 수 조회
        comment_count = get_comment_count_by_prod_id(db, short.prod_id)
        
        # 좋아요 상태 확인 (로그인한 경우에만)
        is_liked = False
        if current_user:
            is_liked = check_user_liked(db, short.prod_id, current_user.id)
        
        items.append(GalleryItemResponse(
            prod_id=short.prod_id,
            file_url=get_file_url(short.file_path),
            like_count=short.like_cnt,
            comment_count=comment_count,
            create_dt=short.create_dt,
            is_liked=is_liked,
        ))
    
    return GalleryListResponse(
        items=items,
        total_count=total_count,
        skip=skip,
        limit=limit,
    )

