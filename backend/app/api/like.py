# 좋아요 관련 엔드포인트
# 작성일: 2025-11-29
# 수정내역
# - 2025-11-29: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.orm import get_orm_session
from app.core.deps import get_current_user, get_optional_user
from app.models.auth import UserInfo
from app.schemas.like import LikeToggleResponse, LikeStatusResponse
from app.services.like_service import (
    toggle_like,
    check_user_liked,
    get_like_count,
)

router = APIRouter(
    prefix="/likes",
    tags=["likes"],
)


@router.post("/toggle/{prod_id}", response_model=LikeToggleResponse, summary="좋아요 토글")
def toggle_like_endpoint(
    prod_id: int,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    좋아요 토글 (좋아요 추가/취소)
    - 로그인 필수
    - 이미 좋아요가 있으면 취소, 없으면 추가
    """
    try:
        result = toggle_like(
            db=db,
            prod_id=prod_id,
            user_id=current_user.id,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"좋아요 처리 실패: {str(e)}",
        )


@router.get("/status/{prod_id}", response_model=LikeStatusResponse, summary="좋아요 상태 조회")
def get_like_status(
    prod_id: int,
    current_user: UserInfo | None = Depends(get_optional_user),
    db: Session = Depends(get_orm_session),
):
    """
    좋아요 상태 조회
    - 로그인하지 않아도 조회 가능 (is_liked는 False)
    - 로그인한 경우 본인이 좋아요를 눌렀는지 확인
    """
    try:
        like_count = get_like_count(db, prod_id)
        is_liked = False
        
        if current_user:
            is_liked = check_user_liked(db, prod_id, current_user.id)
        
        return LikeStatusResponse(
            prod_id=prod_id,
            is_liked=is_liked,
            like_count=like_count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"좋아요 상태 조회 실패: {str(e)}",
        )

