# 브랜드 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from app.schemas.chat import BrandChatRequest, BrandChatResponse, CreateBrandProjectRequest, CreateBrandProjectResponse
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

    brand_session_id = req.brand_session_id or str(uuid4())
    thread_id = f"user-{current_user.id}-project-brand-{brand_session_id}"
    
    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    # 이전 state 복원 시도
    try:
        previous_state_result = brand_graph.get_state(config)
        if previous_state_result and previous_state_result.values:
            # 이전 state가 있으면 그것을 기반으로 사용
            state = dict(previous_state_result.values)
            # 새 메시지만 추가
            state["messages"] = list(state.get("messages", []))
            state["messages"].append(HumanMessage(content=req.message))
        else:
            # 이전 state가 없으면 새로 생성
            state: AppState = {
                "messages": [HumanMessage(content=req.message)],
                "mode": "brand",
                "project_id": None,
                "project_draft": {},
                "brand_profile": {},
                "trend_context": {},
                "meta": {},
            }
    except Exception:
        # get_state() 실패 시 새로 생성
        state: AppState = {
            "messages": [HumanMessage(content=req.message)],
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

    new_state = brand_graph.invoke(
        state,
        config=config,
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
        brand_session_id=brand_session_id,
        project_id=project_id,
        brand_info=new_state["brand_profile"]
    )


@router.post("/create-project", response_model=CreateBrandProjectResponse, status_code=status.HTTP_201_CREATED)
def create_brand_project(
    req: CreateBrandProjectRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    브랜드 프로젝트 생성 엔드포인트.
    - brand_session_id로 이전 state에서 brand_profile 가져오기
    - prod_grp 생성 → brand_info 생성
    """
    thread_id = f"user-{current_user.id}-project-brand-{req.brand_session_id}"
    
    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    # 이전 state에서 brand_profile 가져오기
    try:
        previous_state_result = brand_graph.get_state(config)
        if previous_state_result and previous_state_result.values:
            brand_profile = previous_state_result.values.get("brand_profile") or {}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="브랜드 정보가 없습니다. 먼저 브랜드 정보를 입력해주세요.",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"브랜드 정보를 가져올 수 없습니다: {str(e)}",
        )

    # 필수 필드 확인 (brand_name, category)
    brand_name = brand_profile.get("brand_name", "").strip()
    category = brand_profile.get("category", "").strip()
    
    if not brand_name or not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="브랜드명과 업종은 필수 항목입니다.",
        )

    # 프로젝트명 결정 (grp_nm이 없으면 brand_name 사용)
    grp_nm = req.grp_nm or brand_name

    # 프로젝트 생성
    from app.services.project_service import persist_brand_project
    
    project_draft = {
        "grp_nm": grp_nm,
        "grp_desc": req.grp_desc,
        "creator_id": current_user.id,
    }
    
    group = persist_brand_project(
        db,
        creator_id=current_user.id,
        project_id=None,  # 새로 생성
        project_draft=project_draft,
        brand_profile=brand_profile,
    )
    
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="프로젝트 생성에 실패했습니다.",
        )

    return CreateBrandProjectResponse(
        project_id=group.grp_id,
        grp_nm=group.grp_nm,
        grp_desc=group.grp_desc,
    )