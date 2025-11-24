# 브랜드 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import BrandChatRequest, BrandChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage
from app.agents.state import AppState 
from app.agents.brand_agent import build_brand_graph
from app.services.brand_service import persist_brand_from_graph_state

from uuid import uuid4

router = APIRouter(
    prefix="/brand",
    tags=["brand"],
)

brand_graph = build_brand_graph()

@router.post("/chat", response_model=BrandChatResponse)
def chat_brand(
    req: BrandChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    브랜드 정보 수집/브랜드 상담 챗봇 엔드포인트.
    project_id 는 처음에는 None 이고,
    사용자가 '생성하기' 액션을 했을 때
    실제 prod_grp + brand_info 를 생성하고 project_id 를 발급
    """

    # TODO: BrandGraph 연결 지점
    state: AppState = {
        "messages": [],
        "mode": "brand",
        "project_id": None,
        "project_draft": {},
        "brand_profile": {},
        "trend_context": {},
        "meta": {},
    }

    if req.grp_nm:
        state["project_draft"] = {
            "grp_nm": req.grp_nm,
            "grp_desc": req.grp_desc,
            "creator_id": current_user.id,
        }
    
    state["messages"].append(HumanMessage(content=req.message))

    brand_session_id = req.brand_session_id or str(uuid4())

    new_state = brand_graph.invoke(
        state,
        config={
            "configurable": {
                "thread_id": f"user-{current_user.id}-project-brand-{brand_session_id}"
            }
        },
    )

    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    project_id: int | None = None

    group = persist_brand_from_graph_state(
        db,
        current_user=current_user,
        state=new_state,
    )
    if group is not None:
        project_id = group.grp_id

    # 그래프가 나중에 project_id 를 직접 세팅하면 그걸 fallback 으로 사용
    if project_id is None and new_state.get("project_id") is not None:
        project_id = new_state.get("project_id")

    return BrandChatResponse(
        reply=reply_text,
        project_id=project_id,
        brand_info=new_state["brand_profile"]
    )