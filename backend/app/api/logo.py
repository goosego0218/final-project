# 로고 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import LogoChatRequest, LogoChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage
from app.agents.state import AppState 
from app.agents.logo_agent import build_logo_graph

from uuid import uuid4

router = APIRouter(
    prefix="/logo",
    tags=["logo"],
)

logo_graph = build_logo_graph()

@router.post("/chat", response_model=LogoChatResponse)
def chat_logo(
    req: LogoChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 브리프/생성을 위한 챗봇 엔드포인트.

    - 반드시 project_id 가 있어야 한다.
      (브랜드 챗봇을 통해 이미 생성된 프로젝트/브랜드를 대상으로 하기 때문)
    - 브랜드 챗봇에서 project_id 가 생성된 후,
      같은 화면에서 '로고 만들기'를 선택하면 그 project_id 를 들고 이 엔드포인트를 친다.
    """
    # 프로젝트 id 확인
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo 챗봇 호출 시 project_id 는 필수입니다.",
        )
    
    # TODO: logo 에이전트 호출
    from app.services.project_service import load_brand_profile_for_agent
    brand_profile = load_brand_profile_for_agent(db, req.project_id)

    logo_session_id = req.logo_session_id or str(uuid4())

    state: AppState = {
        "messages": [HumanMessage(content=req.message)],
        "mode": "logo",
        "project_id": req.project_id,
        "project_draft": {},         
        "brand_profile": brand_profile,
        "trend_context": {},
        "meta": {},
    }

    new_state = logo_graph.invoke(
        state,
        config={"configurable": {
            "thread_id": f"user-{current_user.id}-project-{req.project_id}-logo-{logo_session_id}"
        }},
    )

    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    return LogoChatResponse(
        reply=reply_text,
        project_id=req.project_id,
    )