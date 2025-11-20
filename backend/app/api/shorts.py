# 쇼츠 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import ShortsChatRequest, ShortsChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage
from app.agents.state import AppState 
from app.agents.brand_agent import build_brand_graph
from app.agents.logo_agent import build_logo_graph
from app.agents.shorts_agent import build_shorts_graph

from uuid import uuid4

router = APIRouter(
    prefix="/shorts",
    tags=["shorts"],
)

shorts_graph = build_shorts_graph()

@router.post("/chat", response_model=ShortsChatResponse)
def chat_shorts(
    req: ShortsChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    숏폼(쇼츠/릴스) 아이디어/스크립트 챗봇 엔드포인트.

    - 반드시 project_id 가 있어야 한다.
      (이미 생성된 브랜드를 기반으로 숏폼 콘텐츠를 만들기 때문)
    - 브랜드 챗봇에서 project_id 가 생성된 후,
      같은 화면에서 '숏폼 만들기'를 선택하면 그 project_id 를 들고 이 엔드포인트를 친다.
    """
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="shorts 챗봇 호출 시 project_id 는 필수입니다.",
        )
    
    # TODO: shorts 에이전트 호출
    from app.services.project_service import load_brand_profile_for_agent

    brand_profile = load_brand_profile_for_agent(db, req.project_id)

    shorts_session_id = req.shorts_session_id or str(uuid4())

    state: AppState = {
        "messages": [HumanMessage(content=req.message)],
        "mode": "shorts",
        "project_id": req.project_id,
        "project_draft": {},         
        "brand_profile": brand_profile,
        "trend_context": {},
        "meta": {},
    }

    new_state = shorts_graph.invoke(
        state,
        config={"configurable": {
            "thread_id": f"user-{current_user.id}-project-{req.project_id}-shorts-{shorts_session_id}"
        }},
    )

    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    return ShortsChatResponse(
        reply=reply_text,
        project_id=req.project_id,
    )

