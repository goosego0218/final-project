# 브랜드 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import asyncio
import json
from typing import AsyncGenerator

from app.schemas.chat import BrandChatRequest, BrandChatResponse, CreateBrandProjectRequest, CreateBrandProjectResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage, AIMessage
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


@router.post("/chat/stream")
async def chat_brand_stream(
    req: BrandChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    브랜드 챗봇 스트리밍 엔드포인트.
    LLM의 토큰 단위 스트리밍을 지원합니다.
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
            state = dict(previous_state_result.values)
            state["messages"] = list(state.get("messages", []))
            state["messages"].append(HumanMessage(content=req.message))
        else:
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

    async def generate_stream() -> AsyncGenerator[str, None]:
        """스트리밍 응답 생성기"""
        try:
            # 세션 ID 전송
            yield f"data: {json.dumps({'type': 'session', 'brand_session_id': brand_session_id})}\n\n"
            
            # 그래프를 실행하되, brand_chat 노드에 도달하기 전까지 실행
            # brand_chat 노드에 도달하면 LLM을 직접 스트리밍 모드로 호출
            
            from app.graphs.nodes.brand.brand_chat_node import make_brand_chat_node
            from app.llm.client import get_fast_chat_model
            from langchain_core.messages import SystemMessage, AnyMessage
            from app.graphs.nodes.brand.prompt.brand_chat_node_prompts import (
                BRAND_CHAT_SYSTEM_PROMPT,
                SMALLTALK_SYSTEM_PROMPT,
            )
            
            # 그래프를 실행하여 brand_chat 노드까지 진행
            # 먼저 intention, collect 등의 노드를 실행
            intermediate_state = state
            async for event in brand_graph.astream(state, config=config):
                for node_name, node_output in event.items():
                    if node_name != "brand_chat":
                        # brand_chat이 아닌 노드의 결과를 state에 반영
                        if isinstance(node_output, dict):
                            intermediate_state = {**intermediate_state, **node_output}
                    
                    # brand_chat 노드에 도달하면 LLM 스트리밍 시작
                    if node_name == "brand_chat":
                        # brand_chat_node의 로직을 직접 실행 (스트리밍 모드)
                        llm = get_fast_chat_model()
                        messages: list = list(intermediate_state.get("messages") or [])
                        brand_profile = intermediate_state.get("brand_profile") or {}
                        meta: dict = dict(intermediate_state.get("meta") or {})
                        
                        intent_label = None
                        intent_info = meta.get("intent") or {}
                        if isinstance(intent_info, dict):
                            il = intent_info.get("label")
                            if isinstance(il, str):
                                intent_label = il
                        
                        validation: dict = dict(meta.get("validation") or {})
                        required_missing = validation.get("required_missing") or []
                        is_valid = bool(validation.get("is_valid", True))
                        
                        missing_labels: list = []
                        if "brand_name" in required_missing:
                            missing_labels.append("브랜드 이름")
                        if "category" in required_missing:
                            missing_labels.append("업종")
                        
                        trend_context: dict = dict(intermediate_state.get("trend_context") or {})
                        has_trend_result = bool(trend_context.get("last_result_summary"))
                        
                        # 시스템 메시지 구성
                        if intent_label == "smalltalk":
                            system = SystemMessage(content=SMALLTALK_SYSTEM_PROMPT)
                        else:
                            # 브랜드 프로필 포맷팅
                            profile_lines = ["현재까지 파악된 브랜드 정보:"]
                            if brand_profile.get("brand_name"):
                                profile_lines.append(f"- 브랜드명: {brand_profile['brand_name']}")
                            if brand_profile.get("category"):
                                profile_lines.append(f"- 업종/카테고리: {brand_profile['category']}")
                            if brand_profile.get("tone_mood"):
                                profile_lines.append(f"- 톤/분위기: {brand_profile['tone_mood']}")
                            if brand_profile.get("core_keywords"):
                                profile_lines.append(f"- 핵심 키워드: {brand_profile['core_keywords']}")
                            if brand_profile.get("slogan"):
                                profile_lines.append(f"- 슬로건/한 줄 소개: {brand_profile['slogan']}")
                            if brand_profile.get("target_age"):
                                profile_lines.append(f"- 타깃 연령대: {brand_profile['target_age']}")
                            if brand_profile.get("target_gender"):
                                profile_lines.append(f"- 타깃 성별: {brand_profile['target_gender']}")
                            if brand_profile.get("avoided_trends"):
                                profile_lines.append(f"- 피하고 싶은 분위기/트렌드: {brand_profile['avoided_trends']}")
                            if brand_profile.get("preferred_colors"):
                                profile_lines.append(f"- 선호 색상/색감: {brand_profile['preferred_colors']}")
                            
                            profile_text = "\n".join(profile_lines) if len(profile_lines) > 1 else "아직 확정된 브랜드 정보가 거의 없습니다."
                            system_content = f"{BRAND_CHAT_SYSTEM_PROMPT}\n\n{profile_text}"
                            
                            # 추가 지시사항 (기존 로직과 동일)
                            if intent_label == "finalize":
                                if not is_valid:
                                    missing_text = ", ".join(missing_labels) if missing_labels else "브랜드 이름, 업종"
                                    system_content += (
                                        "\n\n[필수 정보 보완 지시]\n"
                                        f"브랜드를 최종 정리하기 전에, 다음 필수 항목이 아직 정리되지 않았습니다: {missing_text}.\n"
                                        "사용자에게 자연스럽게 다시 질문해서 이 정보를 먼저 채워 넣으세요."
                                    )
                                else:
                                    system_content += (
                                        "\n\n[브랜드 확정 지시]\n"
                                        "현재 brand_profile 에 필수 정보(브랜드 이름, 업종)가 모두 채워져 있습니다.\n"
                                        "지금까지 모인 브랜드 정보를 간단히 요약해 주고, "
                                        "\"이대로 브랜드를 확정해도 될까요?\" 라고 자연스럽게 확인 질문을 던지세요."
                                    )
                            elif required_missing and missing_labels:
                                missing_text = ", ".join(missing_labels)
                                system_content += (
                                    "\n\n[부족 정보 안내]\n"
                                    f"브랜드 대화를 이어가면서, 다음 필수 항목도 자연스럽게 질문해서 채워 넣으세요: {missing_text}."
                                )
                            elif is_valid:
                                system_content += (
                                    "\n\n[필수값 완료 상태 안내 - 반드시 준수]\n"
                                    "현재 필수 정보(브랜드 이름, 업종)가 모두 채워져 있습니다.\n"
                                    "옵션값(톤앤무드, 타겟 연령, 타겟 성별, 슬로건, 핵심 키워드, 피하고 싶은 트렌드, 선호 색상)은 선택사항입니다.\n"
                                    "- 옵션값에 대해 1~2가지만 자연스럽게 질문할 수 있지만, 모든 옵션값을 채우려고 강요하지 마세요.\n"
                                    "- **중요: 필수값이 채워진 후 첫 번째 응답에서 반드시 옵션값 질문과 함께 또는 같은 문장에, 다음 단계(쇼츠/로고 생성)로 넘어갈 수 있다는 것을 명시적으로 안내해야 합니다.**\n"
                                )
                            
                            if has_trend_result:
                                system_content += (
                                    "\n\n[트렌드 검색 결과 처리 지시 - 절대 준수]\n"
                                    "중요: 이전 대화 히스토리에 트렌드 검색 결과가 포함되어 있습니다.\n"
                                    "트렌드 검색 결과를 참고하여 답변할 때 다음 규칙을 반드시 준수해야 합니다:\n"
                                    "1. 트렌드 검색 결과에 포함된 모든 URL은 절대 제거하거나 생략하지 말고, 반드시 답변에 포함시켜야 합니다.\n"
                                    "2. 답변 마지막에 '참고 자료' 또는 '근거' 섹션을 반드시 추가하고, 해당 섹션에 모든 URL을 원본 그대로 나열해야 합니다.\n"
                                )
                            
                            system = SystemMessage(content=system_content)
                        
                        chat_messages: list = [system]
                        chat_messages.extend(messages)
                        
                        # LLM 스트리밍 호출
                        accumulated_content = ""
                        async for chunk in llm.astream(chat_messages):
                            if hasattr(chunk, 'content') and chunk.content:
                                accumulated_content += chunk.content
                                # 토큰 단위로 스트리밍
                                yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
                        
                        # 스트리밍 완료 후 그래프 업데이트
                        from langchain_core.messages import AIMessage
                        ai_msg = AIMessage(content=accumulated_content)
                        intermediate_state["messages"] = list(intermediate_state.get("messages", []))
                        intermediate_state["messages"].append(ai_msg)
                        break
            
            # 최종 state 가져오기 및 저장
            final_state_result = brand_graph.get_state(config)
            if final_state_result and final_state_result.values:
                final_state = final_state_result.values
                
                # 프로젝트 저장
                project_id: int | None = None
                group = persist_brand_from_graph_state(
                    db,
                    current_user=current_user,
                    state=final_state,
                )
                if group is not None:
                    project_id = group.grp_id
                
                if project_id is None and final_state.get("project_id") is not None:
                    project_id = final_state.get("project_id")
                
                # 최종 메타데이터 전송
                yield f"data: {json.dumps({'type': 'metadata', 'project_id': project_id, 'brand_info': final_state.get('brand_profile', {})})}\n\n"
            
            # 완료 신호
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            import traceback
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
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