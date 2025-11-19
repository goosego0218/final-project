# 챗봇 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: 브랜드, 로고, 쇼츠 엔드포인트 작성

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import ChatRequest, ChatResponse
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
    prefix="/chat",
    tags=["chat"],
)

brand_graph = build_brand_graph()
logo_graph = build_logo_graph()
shorts_graph = build_shorts_graph()

@router.post("/brand", response_model=ChatResponse)
def chat_brand(
    req: ChatRequest,
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
        "project_id": req.project_id,
        "project_draft": {},
        "brand_profile": {},
        "trend_context": {},
        "meta": {},
    }

    if req.project_id is None and req.grp_nm:
        state["project_draft"] = {
            "grp_nm": req.grp_nm,
            "grp_desc": req.grp_desc,
            "creator_id": current_user.id,
        }

    # 기존 프로젝트가 있다면 브랜드 정보 로드
    ## 현재 로직 상 프로젝트 수정은 없어서 실행되진 않음
    if req.project_id is not None:
        from app.services.project_service import load_brand_profile_for_agent

        profile = load_brand_profile_for_agent(db, req.project_id)
        state["brand_profile"] = profile
    
    state["messages"].append(HumanMessage(content=req.message))

    brand_session_id = req.brand_session_id or str(uuid4())

    new_state = brand_graph.invoke(
        state,
        config={"configurable": {
            "thread_id": f"user-{current_user.id}-project-{req.project_id}-brand-{brand_session_id}"
        }},
    )


    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    project_id = new_state.get("project_id", req.project_id)

    return ChatResponse(
        reply=reply_text,
        project_id=project_id,
    )

@router.post("/logo", response_model=ChatResponse)
def chat_logo(
    req: ChatRequest,
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

    return ChatResponse(
        reply=reply_text,
        project_id=req.project_id,
    )

@router.post("/shorts", response_model=ChatResponse)
def chat_shorts(
    req: ChatRequest,
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

    return ChatResponse(
        reply=reply_text,
        project_id=req.project_id,
    )