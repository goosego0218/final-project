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
from app.agents.state import BrandState
from app.agents.brand_agent import build_brand_graph

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

brand_graph = build_brand_graph()

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
    state: BrandState = {
        "messages": [],
        "mode": "brand",
        "project_id": req.project_id,
        "brand_profile": {},
        "trend_context": {},
        "meta": {},
    }

    if req.project_id is None and req.grp_nm:
        state["draft_grp_nm"] = req.grp_nm
        state["draft_grp_desc"] = req.grp_desc
        state["draft_creator_id"] = current_user.id

    # 기존 프로젝트가 있다면 브랜드 정보 로드
    ## 현재 로직 상 프로젝트 수정은 없어서 실행되진 않음
    if req.project_id is not None:
        from app.services.project_service import load_brand_profile_for_agent

        profile = load_brand_profile_for_agent(db, req.project_id)
        state["brand_profile"] = profile
    
    state["messages"].append(HumanMessage(content=req.message))

    new_state = brand_graph.invoke(
        state,
        # config는 일단 비워둬도 되고, 나중에 user_id/thread_id 등 넣어도 됨
        # config={"configurable": {"user_id": current_user.id}},
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
    
    # TODO:
    #  1) 해당 project_id 의 브랜드 정보(brand_info) 를 DB 에서 로드해서
    #     AppState.brand_profile 에 미리 채워 넣기
    #  2) 이전 로고 대화 state 가 있다면 불러오기
    #  3) state["messages"] 에 HumanMessage(req.message) 추가
    #  4) LogoGraph 실행
    #  5) 마지막 AIMessage content 를 reply 로 반환

    reply = "[logo] AI의 답변입니다."

    return ChatResponse(
        reply=reply,
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
    
    # TODO:
    #  1) project_id 기준 BrandInfo 로부터 브랜드 컨텍스트 로드
    #  2) 이전 숏폼 대화 state 있으면 불러오기
    #  3) state["messages"] 에 HumanMessage(req.message) 추가
    #  4) ShortsGraph 실행
    #  5) 마지막 AIMessage content 를 reply 로 반환

    reply = "[shorts] AI의 답변입니다."

    return ChatResponse(
        reply=reply,
        project_id=req.project_id,
    )