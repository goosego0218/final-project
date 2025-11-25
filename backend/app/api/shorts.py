# 쇼츠 관련 엔드포인트
# 작성자: 주후상
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-21: 첫진입시 브랜드 요약 반환 추가 
#   "@router.post("/intro")" 추가
# - 2025-11-23: 숏폼 에이전트 resume 엔드포인트 추가
#   "@router.post("/resume")" 추가


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from langgraph.types import Command
from langgraph.errors import GraphInterrupt
from langchain_core.messages import HumanMessage

from app.graphs.nodes.common.brand_summary import summarize_brand_profile_with_llm 
from app.schemas.chat import ShortsResumeRequest, ShortsResumeResponse, ShortsChatRequest, ShortsChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from app.agents.state import AppState 
from app.agents.shorts_agent import build_shorts_graph

from uuid import uuid4

router = APIRouter(
    prefix="/shorts",
    tags=["shorts"],
)

shorts_graph = build_shorts_graph()

@router.post("/chat", response_model=ShortsChatResponse, summary="숏폼 챗봇")
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
        "shorts_state": {},
        "meta": {},
    }

    new_state = shorts_graph.invoke(
        state,
        config={"configurable": {
            "thread_id": f"user-{current_user.id}-project-{req.project_id}-shorts-{shorts_session_id}"
        }},
    )

    interrupts = new_state.get("__interrupt__")
    print(">>> interrupts:", interrupts)

    if interrupts:
        # tuple[Interrupt, ---] 형태
        intr = interrupts[0]
        payload = intr.value  # interrupt()에 넘긴 dict

        # payload 안에 messages를 넣어놨으니까 (check_logo_node 참고)
        messages = payload["messages"]
        last_msg = messages[-1]
        reply_text = last_msg.content

        return ShortsChatResponse(
            reply=reply_text,
            project_id=req.project_id,
            shorts_session_id=shorts_session_id,
        )
    
    # 인터럽트 없이 진행된경우우
    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    return ShortsChatResponse(
        reply=reply_text,
        project_id=req.project_id,
        shorts_session_id=shorts_session_id
    )

#----------------------------------------25-11-21 첫진입시 브랜드 요약------------------------
@router.post("/intro", response_model=ShortsChatResponse, summary="숏폼 진입 시 브랜드 정보 요약")
def get_shorts_intro(
    req: ShortsChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    숏폼 에이전트 진입 시 브랜드 정보 요약을 반환하는 엔드포인트.
    
    - 프론트에서 "숏폼 만들기" 클릭 후 컴포넌트 마운트 시 호출
    - 브랜드 프로필을 LLM으로 요약하여 시스템 메시지처럼 반환
    - project_id만 필요하고 message는 사용하지 않음
    """
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="shorts intro 호출 시 project_id 는 필수입니다.",
        )
    
    from app.services.project_service import load_brand_profile_for_agent
    
    brand_profile = load_brand_profile_for_agent(db, req.project_id)
    brand_summary = summarize_brand_profile_with_llm(brand_profile)
    shorts_session_id = req.shorts_session_id or str(uuid4())

    return ShortsChatResponse(
        reply=brand_summary,
        project_id=req.project_id,
        shorts_session_id=shorts_session_id,
    )

@router.post("/resume", response_model=ShortsResumeResponse, summary="인터럽트 전용 라우터")
def resume_shorts(
    req: ShortsResumeRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    숏폼 에이전트 resume 엔드포인트.
    - interrupt 상태에서 사용자 응답(Y/N 등)을 받아 재개한다.
    """
    print("세션ID :", req.shorts_session_id)
    if not req.shorts_session_id:
        raise HTTPException(
            status_code=400,
            detail="shorts_session_id 는 필수입니다."
        )

    if req.answer.upper() not in ("Y", "N"):
        raise HTTPException(400, "answer 값은 Y 또는 N 이어야 합니다.")

    config = {"configurable": {"thread_id": f"user-{current_user.id}-project-{req.project_id}-shorts-{req.shorts_session_id}"}}
    
    resume_value = req.answer  # Y / N 
    
    print("[resume] Command(resume)으로 그래프 재개")
    result_state = shorts_graph.invoke(
        Command(resume=resume_value),
        config=config,
    )

    # 다시 인터럽트 걸렸는지 체크
    interrupts = result_state.get("__interrupt__")
    if interrupts:
        intr = interrupts[0]
        payload = intr.value
        messages = payload["messages"]
        last_msg = messages[-1]
        reply_text = last_msg.content

        return ShortsResumeResponse(
            reply=reply_text,
            project_id=req.project_id,
            shorts_session_id=req.shorts_session_id,
        )

    # END까지 간 경우
    messages = result_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    return ShortsResumeResponse(
        reply=reply_text,
        project_id=req.project_id,
        shorts_session_id=req.shorts_session_id,
    )