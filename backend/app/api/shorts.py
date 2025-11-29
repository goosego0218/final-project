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
from typing import List

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
from app.services.shorts_service import save_shorts_to_storage_and_db, get_shorts_list, update_shorts_pub_yn
from app.schemas.shorts import SaveShortsRequest, SaveShortsResponse, ShortsListItemResponse, UpdateShortsPubYnRequest, UpdateShortsPubYnResponse
from app.utils.file_utils import get_file_url

from uuid import uuid4

router = APIRouter(
    prefix="/shorts",
    tags=["shorts"],
)

# 그래프를 지연 로딩 (필요할 때만 빌드)
_shorts_graph = None

def get_shorts_graph():
    """그래프를 지연 로딩 (필요할 때만 빌드)"""
    global _shorts_graph
    if _shorts_graph is None:
        _shorts_graph = build_shorts_graph()
    return _shorts_graph

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

    new_state = get_shorts_graph().invoke(
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
        brand_summary = summarize_brand_profile_with_llm(brand_profile, mode="shorts")
    except Exception as e:
        # LLM 호출 실패 시 기본 요약 생성
        brand_name = brand_profile.get("brand_name", "브랜드")
        category = brand_profile.get("category", "")
        brand_summary = f"{brand_name}은(는) {category} 업종의 브랜드입니다. 숏폼을 만들어볼까요?"
        # 로그는 남기되 사용자에게는 기본 메시지 반환
        import logging
        logging.error(f"브랜드 요약 생성 실패: {e}")
    
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
    result_state = get_shorts_graph().invoke(
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

@router.post("/save", response_model=SaveShortsResponse, summary="쇼츠 저장")
def save_shorts(
    req: SaveShortsRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    생성된 쇼츠를 NCP Object Storage에 업로드하고 DB에 저장
    """
    if not req.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id는 필수입니다."
        )
    
    try:
        prod = save_shorts_to_storage_and_db(
            db=db,
            base64_video=req.base64_video,
            project_id=req.project_id,
            prod_type_id=req.prod_type_id or 2,
            user_id=current_user.id,
        )
        
        from app.utils.file_utils import get_file_url
        file_url = get_file_url(prod.file_path)
        
        return SaveShortsResponse(
            success=True,
            message="쇼츠가 성공적으로 저장되었습니다.",
            prod_id=prod.prod_id,
            file_path=prod.file_path,
            file_url=file_url,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"쇼츠 저장 실패: {str(e)}"
        )

@router.get("/list", response_model=List[ShortsListItemResponse], summary="쇼츠 목록 조회")
def get_shorts_list_endpoint(
    project_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트의 저장된 쇼츠 목록 조회
    
    - project_id: 프로젝트 그룹 ID (query parameter)
    - 현재 로그인한 사용자가 생성한 프로젝트의 쇼츠만 조회 가능
    """
    # 프로젝트 접근 권한 확인
    from app.services.project_service import load_project_group_entity
    
    project = load_project_group_entity(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )
    
    # 본인이 생성한 프로젝트인지 확인
    if project.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다.",
        )
    
    # 쇼츠 목록 조회
    shorts_list = get_shorts_list(db=db, project_id=project_id, prod_type_id=2)
    
    # 응답 모델로 변환
    result = []
    for prod in shorts_list:
        file_url = get_file_url(prod.file_path)
            result.append(ShortsListItemResponse(
                prod_id=prod.prod_id,
                file_path=prod.file_path,
                file_url=file_url,
                create_dt=prod.create_dt.isoformat() if prod.create_dt else None,
                pub_yn=prod.pub_yn,
            ))
    
    return result


@router.patch("/{prod_id}/pub-yn", response_model=UpdateShortsPubYnResponse, summary="쇼츠 공개 여부 업데이트")
def update_shorts_pub_yn_endpoint(
    prod_id: int,
    req: UpdateShortsPubYnRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    쇼츠 공개 여부 업데이트 (PUB_YN)
    
    - prod_id: 업데이트할 쇼츠의 생성물 ID (path parameter)
    - pub_yn: 공개 여부 ('Y' 또는 'N') (body)
    - 본인이 생성한 쇼츠만 수정 가능
    """
    try:
        updated_prod = update_shorts_pub_yn(
            db=db,
            prod_id=prod_id,
            pub_yn=req.pub_yn,
            user_id=current_user.id,
        )
        
        return UpdateShortsPubYnResponse(
            success=True,
            message="공개 여부가 업데이트되었습니다.",
            prod_id=updated_prod.prod_id,
            pub_yn=updated_prod.pub_yn,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"공개 여부 업데이트 실패: {str(e)}"
        )