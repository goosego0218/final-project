# 마이페이지 관련 API
# 작성일: 2025-12-05

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo
from app.schemas.mypage import MyPageItemsResponse, MyPageItem
from app.services.mypage_service import get_shared_items, get_liked_items

router = APIRouter(
    prefix="/mypage",
    tags=["mypage"],
)


@router.get("/shared", response_model=MyPageItemsResponse, summary="공유한 작품 조회")
def get_shared_items_endpoint(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    공유한 작품 조회:
    - 현재 사용자가 생성한 작품 중 pub_yn = 'Y', del_yn = 'N'인 것들
    """
    items_raw = get_shared_items(db, current_user.id)
    
    items = [
        MyPageItem(
            prod_id=i["prod_id"],
            type=i["type"],
            file_url=i["file_url"],
            title=i["title"],
            likes=i["likes"],
            comments=i["comments"],
            created_at=i["created_at"],
            is_liked=i["is_liked"],
        )
        for i in items_raw
    ]
    
    return MyPageItemsResponse(items=items)


@router.get("/liked", response_model=MyPageItemsResponse, summary="좋아요한 작품 조회")
def get_liked_items_endpoint(
    current_user: UserInfo = Depends(get_current_user),
    db: Session = Depends(get_orm_session),
):
    """
    좋아요한 작품 조회:
    - 현재 사용자가 좋아요를 누른 작품 중 pub_yn = 'Y', del_yn = 'N'인 것들
    """
    items_raw = get_liked_items(db, current_user.id)
    
    items = [
        MyPageItem(
            prod_id=i["prod_id"],
            type=i["type"],
            file_url=i["file_url"],
            title=i["title"],
            likes=i["likes"],
            comments=i["comments"],
            created_at=i["created_at"],
            is_liked=i["is_liked"],
        )
        for i in items_raw
    ]
    
    return MyPageItemsResponse(items=items)

