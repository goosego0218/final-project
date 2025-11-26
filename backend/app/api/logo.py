# 로고 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-24: intro 엔드포인트 추가

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import LogoChatRequest, LogoChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage
from app.agents.state import AppState 
from app.agents.logo_agent import build_logo_graph
from app.graphs.nodes.common.brand_summary import summarize_brand_profile_with_llm

from uuid import uuid4

router = APIRouter(
    prefix="/logo",
    tags=["logo"],
)

logo_graph = build_logo_graph()

@router.post("/intro", response_model=LogoChatResponse, summary="로고 진입 시 브랜드 정보 요약")
def get_logo_intro(
    req: LogoChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 에이전트 진입 시 브랜드 정보 요약을 반환하는 엔드포인트.
    
    - 프론트에서 "로고 만들기" 클릭 후 컴포넌트 마운트 시 호출
    - 브랜드 프로필을 LLM으로 요약하여 시스템 메시지처럼 반환
    - project_id만 필요하고 message는 사용하지 않음
    """
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo intro 호출 시 project_id 는 필수입니다.",
        )
    
    from app.services.project_service import load_brand_profile_for_agent
    
    try:
        brand_profile = load_brand_profile_for_agent(db, req.project_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    
    # 브랜드 프로필이 비어있거나 필수 정보가 없는 경우
    if not brand_profile or not brand_profile.get("brand_name") or not brand_profile.get("category"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="브랜드 정보가 충분하지 않습니다. 브랜드명과 업종이 필요합니다.",
        )
    
    try:
        brand_summary = summarize_brand_profile_with_llm(brand_profile)
    except Exception as e:
        # LLM 호출 실패 시 기본 요약 생성
        brand_name = brand_profile.get("brand_name", "브랜드")
        category = brand_profile.get("category", "")
        brand_summary = f"{brand_name}은(는) {category} 업종의 브랜드입니다. 로고를 만들어볼까요?"
        # 로그는 남기되 사용자에게는 기본 메시지 반환
        import logging
        logging.error(f"브랜드 요약 생성 실패: {e}")
    
    logo_session_id = req.logo_session_id or str(uuid4())

    return LogoChatResponse(
        reply=brand_summary,
        project_id=req.project_id,
        logo_session_id=logo_session_id,
    )

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
    
    # message 확인 (chat 엔드포인트에서는 필수)
    if not req.message or not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo 챗봇 호출 시 message 는 필수입니다.",
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
        logo_session_id=logo_session_id,
    )