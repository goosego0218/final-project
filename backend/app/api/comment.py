# 댓글 관련 엔드포인트
# 작성일: 2025-11-28
# 수정내역
# - 2025-11-28: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo
from app.schemas.comment import (
    CommentCreateRequest,
    CommentUpdateRequest,
    CommentResponse,
    CommentListResponse,
)
from app.services.comment_service import (
    create_comment,
    update_comment,
    get_comments_by_prod_id,
    delete_comment,
    get_comment_count_by_prod_id,
)

router = APIRouter(
    prefix="/comments",
    tags=["comments"],
)


@router.get("/", response_model=CommentListResponse, summary="댓글 목록 조회")
def get_comments(
    prod_id: int,
    db: Session = Depends(get_orm_session),
):
    """
    생성물의 댓글 목록 조회
    - prod_id: 생성물 번호 (숏폼 또는 로고)
    """
    try:
        comments_with_users = get_comments_by_prod_id(db, prod_id)
        
        # CommentResponse로 변환
        comment_responses = []
        for comment, user in comments_with_users:
            comment_responses.append(CommentResponse(
                comment_id=comment.comment_id,
                prod_id=comment.prod_id,
                user_id=comment.user_id,
                user_nickname=user.nickname,  # join으로 가져온 UserInfo
                content=comment.content,
                create_dt=comment.create_dt,
                update_dt=comment.update_dt,
            ))
        
        return CommentListResponse(
            comments=comment_responses,
            total_count=len(comment_responses),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"댓글 목록 조회 실패: {str(e)}",
        )


@router.post("/", response_model=CommentResponse, summary="댓글 작성")
def create_comment_endpoint(
    request: CommentCreateRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    댓글 작성
    - 로그인 필수
    """
    try:
        comment = create_comment(
            db=db,
            prod_id=request.prod_id,
            user_id=current_user.id,
            content=request.content,
        )
        
        # UserInfo와 join하여 nickname 가져오기
        from app.models.project import Comment
        result = (
            db.query(Comment, UserInfo)
            .join(UserInfo, Comment.user_id == UserInfo.id)
            .filter(Comment.comment_id == comment.comment_id)
            .first()
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="댓글 생성 후 조회에 실패했습니다.",
            )
        
        comment_with_user, user = result
        
        return CommentResponse(
            comment_id=comment_with_user.comment_id,
            prod_id=comment_with_user.prod_id,
            user_id=comment_with_user.user_id,
            user_nickname=user.nickname,
            content=comment_with_user.content,
            create_dt=comment_with_user.create_dt,
            update_dt=comment_with_user.update_dt,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"댓글 작성 실패: {str(e)}",
        )


@router.put("/{comment_id}", response_model=CommentResponse, summary="댓글 수정")
def update_comment_endpoint(
    comment_id: int,
    request: CommentUpdateRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    댓글 수정
    - 본인 댓글만 수정 가능
    """
    try:
        comment = update_comment(
            db=db,
            comment_id=comment_id,
            user_id=current_user.id,
            content=request.content,
        )
        
        # UserInfo와 join하여 nickname 가져오기
        from app.models.project import Comment
        result = (
            db.query(Comment, UserInfo)
            .join(UserInfo, Comment.user_id == UserInfo.id)
            .filter(Comment.comment_id == comment.comment_id)
            .first()
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="댓글 수정 후 조회에 실패했습니다.",
            )
        
        comment_with_user, user = result
        
        return CommentResponse(
            comment_id=comment_with_user.comment_id,
            prod_id=comment_with_user.prod_id,
            user_id=comment_with_user.user_id,
            user_nickname=user.nickname,
            content=comment_with_user.content,
            create_dt=comment_with_user.create_dt,
            update_dt=comment_with_user.update_dt,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"댓글 수정 실패: {str(e)}",
        )


@router.delete("/{comment_id}", summary="댓글 삭제")
def delete_comment_endpoint(
    comment_id: int,
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    댓글 삭제
    - 본인 댓글만 삭제 가능
    """
    try:
        delete_comment(
            db=db,
            comment_id=comment_id,
            user_id=current_user.id,
        )
        return {"message": "댓글이 삭제되었습니다."}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"댓글 삭제 실패: {str(e)}",
        )


@router.get("/count", summary="댓글 개수 조회")
def get_comment_count(
    prod_id: int,
    db: Session = Depends(get_orm_session),
):
    """
    생성물의 댓글 개수 조회
    """
    try:
        count = get_comment_count_by_prod_id(db, prod_id)
        return {"prod_id": prod_id, "count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"댓글 개수 조회 실패: {str(e)}",
        )