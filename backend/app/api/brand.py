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

from app.schemas.chat import (
    BrandChatRequest,
    BrandChatResponse,
    CreateBrandProjectRequest,
    CreateBrandProjectResponse,
    BrandInfoResponse,
)
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.models.auth import UserInfo

from langchain_core.messages import HumanMessage, AIMessage
from app.agents.state import AppState
from app.agents.brand_agent import build_brand_graph
from app.services.brand_service import persist_brand_from_graph_state
from app.services.project_service import load_brand_info_entity

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
        brand_info=new_state["brand_profile"],
    )


@router.get("/info/{project_id}", response_model=BrandInfoResponse)
def get_brand_info(
    project_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    특정 프로젝트(grp_id)에 저장된 브랜드 정보(brand_info 테이블)를 조회하는 엔드포인트.
    - 로그인한 사용자의 프로젝트라는 전제는 project_id 생성 시 이미 보장됨 (추가 권한 체크가 필요하면 확장 가능)
    """
    info = load_brand_info_entity(db, project_id)

    if info is None:
        # brand_info가 아직 생성되지 않은 프로젝트일 수 있으므로 200 + null 응답
        return BrandInfoResponse(brand_info=None)

    brand_info_dict = {
        "brand_name": info.brand_name,
        "category": info.category,
        "tone_mood": info.tone_mood,
        "core_keywords": info.core_keywords,
        "slogan": info.slogan,
        "target_age": info.target_age,
        "target_gender": info.target_gender,
        "avoided_trends": info.avoided_trends,
        "preferred_colors": info.preferred_colors,
    }

    return BrandInfoResponse(brand_info=brand_info_dict)


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

            from app.llm.client import get_fast_chat_model
            from langchain_core.messages import SystemMessage
            from app.graphs.nodes.brand.prompt.brand_chat_node_prompts import (
                BRAND_CHAT_SYSTEM_PROMPT,
                SMALLTALK_SYSTEM_PROMPT,
            )

            intermediate_state = state

            async for event in brand_graph.astream(state, config=config):
                for node_name, node_output in event.items():
                    if node_name != "brand_chat" and node_name != "trend_search":
                        if isinstance(node_output, dict):
                            intermediate_state = {**intermediate_state, **node_output}

                    if node_name == "trend_search":
                        if isinstance(node_output, dict):
                            intermediate_state = {**intermediate_state, **node_output}
                            # messages에서 마지막 AIMessage 찾기 (트렌드 결과)
                            messages = list(intermediate_state.get("messages") or [])
                            if messages:
                                last_msg = messages[-1]
                                # 파일 상단에서 이미 import한 AIMessage 사용
                                if isinstance(last_msg, AIMessage) and hasattr(last_msg, "content"):
                                    # 트렌드 결과를 스트리밍으로 전송
                                    trend_content = last_msg.content
                                    # 긴 텍스트를 청크로 나눠서 스트리밍 (자연스러운 타이핑 효과)
                                    chunk_size = 50  # 한 번에 전송할 문자 수
                                    for i in range(0, len(trend_content), chunk_size):
                                        chunk = trend_content[i:i + chunk_size]
                                        yield "data: " + json.dumps(
                                            {"type": "token", "content": chunk},
                                            ensure_ascii=False,
                                        ) + "\n\n"
                                        # 약간의 딜레이로 자연스러운 타이핑 효과
                                        await asyncio.sleep(0.01)

                    if node_name == "brand_chat":
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
                        trend_summary: str = str(trend_context.get("last_result_summary") or "")
                        has_trend_result: bool = bool(trend_summary)

                        # smalltalk 모드
                        if intent_label == "smalltalk":
                            system = SystemMessage(content=SMALLTALK_SYSTEM_PROMPT)
                        else:
                            # 브랜드 프로필 요약
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
                                profile_lines.append(
                                    f"- 피하고 싶은 분위기/트렌드: {brand_profile['avoided_trends']}"
                                )
                            if brand_profile.get("preferred_colors"):
                                profile_lines.append(
                                    f"- 선호 색상/색감: {brand_profile['preferred_colors']}"
                                )

                            profile_text = (
                                "\n".join(profile_lines)
                                if len(profile_lines) > 1
                                else "아직 확정된 브랜드 정보가 거의 없습니다."
                            )
                            system_content = f"{BRAND_CHAT_SYSTEM_PROMPT}\n\n{profile_text}"

                            if intent_label and intent_label.startswith("trend") and trend_summary:
                                system_content += (
                                    "\n\n[트렌드 분석 결과]\n"
                                    f"{trend_summary}\n\n"
                                    "[지시]\n"
                                    "위 트렌드 분석 내용을 참고하여, 사용자가 이해하기 쉬운 자연스러운 말로 정리하고, "
                                    "브랜드/콘텐츠 방향에 대한 실행 아이디어를 제안하세요. "
                                    "트렌드 텍스트의 핵심 문장과 URL은 가능하면 유지하세요."
                                )

                            # finalize / 필수값 안내 로직
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
                                )

                            # 트렌드 검색 결과가 있었다는 지시 (원래 쓰던 부분 유지)
                            if has_trend_result:
                                system_content += (
                                    "\n\n[트렌드 검색 결과 처리 지시 - 절대 준수]\n"
                                    "이전에 수행한 트렌드 검색 결과를 참고해서 답변해야 합니다.\n"
                                    "답변 마지막에 '참고 자료' 또는 '근거' 섹션을 두고, 검색 과정에서 활용한 URL들을 정리해 주세요.\n"
                                )

                            system = SystemMessage(content=system_content)

                        # 공통: astream 으로 토큰 단위 스트리밍
                        chat_messages: list = [system]
                        chat_messages.extend(messages)

                        accumulated_content = ""
                        async for chunk in llm.astream(chat_messages):
                            if hasattr(chunk, "content") and chunk.content:
                                accumulated_content += chunk.content
                                yield "data: " + json.dumps(
                                    {"type": "token", "content": chunk.content},
                                    ensure_ascii=False,
                                ) + "\n\n"

                        ai_msg = AIMessage(content=accumulated_content)
                        intermediate_state["messages"] = list(
                            intermediate_state.get("messages") or []
                        )
                        intermediate_state["messages"].append(ai_msg)

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
                yield (
                    "data: "
                    + json.dumps(
                        {
                            "type": "metadata",
                            "project_id": project_id,
                            "brand_info": final_state.get("brand_profile", {}),
                        },
                        ensure_ascii=False,
                    )
                    + "\n\n"
                )

            # 완료 신호
            yield "data: " + json.dumps({"type": "done"}) + "\n\n"

        except Exception as e:
            import traceback

            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            yield "data: " + json.dumps({"type": "error", "message": error_msg}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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
