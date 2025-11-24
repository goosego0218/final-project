from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.chat import LogoChatRequest, LogoChatResponse
from app.schemas.logo_schema import LogoRequest, LogoResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage
from app.agents.state import AppState
from app.agents.logo_agent import build_logo_chat_workflow, build_logo_generate_workflow

from uuid import uuid4

router = APIRouter(
    prefix="/logo",
    tags=["logo"],
)

logo_chat_workflow = build_logo_chat_workflow()
logo_generate_workflow = build_logo_generate_workflow()


@router.post("/chat", response_model=LogoChatResponse)
def chat_logo(
    req: LogoChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    # 프로젝트 id 확인
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo 챗봇 요청에는 project_id 가 필수입니다",
        )

    from app.services.project_service import load_brand_profile_for_agent

    brand_profile = load_brand_profile_for_agent(db, req.project_id)

    logo_session_id = req.logo_session_id or str(uuid4())

    state: AppState = {
        "messages": [HumanMessage(content=req.message)],
        "mode": "logo",
        "project_id": req.project_id,
        "logo_type": req.logo_type,
        "trend_choice": req.trend_choice,
        "project_draft": {},
        "brand_profile": brand_profile,
        "trend_context": {},
        "meta": {},
    }

    new_state = logo_chat_workflow.invoke(
        state,
        config={
            "configurable": {
                "thread_id": f"user-{current_user.id}-project-{req.project_id}-logo-{logo_session_id}"
            }
        },
    )

    logo_type = new_state.get("logo_type") or "symbol_plus_text"
    trend = new_state.get("trend_choice") or "(미선택)"
    candidates = new_state.get("reference_candidates") or []
    reference_image = None
    reply_text = new_state.get("reply") or "로고 유형과 트렌드, 참조 이미지를 선택해주세요."

    return LogoChatResponse(
        reply=reply_text,
        project_id=req.project_id,
        logo_session_id=logo_session_id,
        brand_profile=brand_profile,
        reference_image=reference_image,
        reference_candidates=[str(c) for c in candidates],
    )


@router.post("/generate-logo", response_model=LogoResponse)
def generate_logo(request: LogoRequest):
    """
    준비된 값으로 로고를 생성합니다.
    - reference_image, prompt가 필수
    - brand_profile은 선택 전달
    """
    thread_id = f"logo-generate-{uuid4()}"
    result = logo_generate_workflow.invoke(
        {
            "reference_image_path": request.reference_image,
            "user_prompt": request.prompt,
            "brand_profile": request.brand_profile,
        },
        config={
            "configurable": {
                "thread_id": thread_id,
            }
        },
    )
    return LogoResponse(generated_image_url=result["generated_image_url"])
