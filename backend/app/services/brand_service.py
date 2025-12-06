# 브랜드 관련 비즈니스 로직
# 작성일: 2025-11-23
# 수정내역
# - 2025-11-23: 브랜드 프로젝트 저장 래퍼 추가
# - 2025-12-XX: 스트리밍 챗 로직 분리

from __future__ import annotations

from typing import Dict, Any, Optional, AsyncGenerator
import json
import asyncio
import traceback

from sqlalchemy.orm import Session
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.models.project import ProdGroup
from app.models.auth import UserInfo
from app.agents.state import AppState, BrandProfile
from app.services.project_service import persist_brand_project
from app.llm.client import get_fast_chat_model
from app.graphs.nodes.brand.prompt.brand_chat_node_prompts import (
    BRAND_CHAT_SYSTEM_PROMPT,
    SMALLTALK_SYSTEM_PROMPT,
)


def persist_brand_from_graph_state(
    db: Session,
    *,
    current_user: UserInfo,
    state: AppState,
) -> Optional[ProdGroup]:
    """
    브랜드 그래프 실행 결과(AppState)를 받아,
    meta.persist_request 해석 -> 프로젝트/브랜드 DB 저장.

    - 그래프/메타/유저 관련 비즈니스 로직은 여기서만 처리.
    - 실제 INSERT/UPDATE 는 project_service.persist_brand_project 가 담당.
    """
    meta: Dict[str, Any] = dict(state.get("meta") or {})
    persist_request = meta.get("persist_request")

    if not isinstance(persist_request, dict):
        return None

    if persist_request.get("kind") != "brand_project":
        return None

    payload: Dict[str, Any] = dict(persist_request.get("payload") or {})

    project_id = payload.get("project_id")
    project_draft = payload.get("project_draft")
    brand_profile: BrandProfile | Dict[str, Any] | None = payload.get("brand_profile")

    group = persist_brand_project(
        db,
        creator_id=current_user.id,
        project_id=project_id,
        project_draft=project_draft,
        brand_profile=brand_profile,
    )

    return group


def prepare_brand_chat_state(
    brand_graph,
    config: Dict[str, Any],
    message: str,
    grp_nm: Optional[str] = None,
    grp_desc: Optional[str] = None,
    creator_id: Optional[int] = None,
) -> AppState:
    """
    브랜드 챗을 위한 초기 state 준비.
    이전 state가 있으면 복원하고, 없으면 새로 생성.
    """
    try:
        previous_state_result = brand_graph.get_state(config)
        if previous_state_result and previous_state_result.values:
            state = dict(previous_state_result.values)
            state["messages"] = list(state.get("messages", []))
            state["messages"].append(HumanMessage(content=message))
        else:
            state: AppState = {
                "messages": [HumanMessage(content=message)],
                "mode": "brand",
                "project_id": None,
                "project_draft": {},
                "brand_profile": {},
                "trend_context": {},
                "meta": {},
            }
    except Exception:
        state: AppState = {
            "messages": [HumanMessage(content=message)],
            "mode": "brand",
            "project_id": None,
            "project_draft": {},
            "brand_profile": {},
            "trend_context": {},
            "meta": {},
        }

    if grp_nm:
        state["project_draft"] = {
            "grp_nm": grp_nm,
            "grp_desc": grp_desc,
            "creator_id": creator_id,
        }

    return state


def build_brand_chat_system_prompt(
    brand_profile: Dict[str, Any],
    meta: Dict[str, Any],
    trend_context: Dict[str, Any],
) -> SystemMessage:
    """
    브랜드 챗을 위한 시스템 프롬프트 생성.
    """
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

    trend_summary: str = str(trend_context.get("last_result_summary") or "")
    has_trend_result: bool = bool(trend_summary)

    # smalltalk 모드
    if intent_label == "smalltalk":
        return SystemMessage(content=SMALLTALK_SYSTEM_PROMPT)

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

    # 트렌드 검색 결과가 있었다는 지시
    if has_trend_result:
        system_content += (
            "\n\n[트렌드 검색 결과 처리 지시 - 절대 준수]\n"
            "이전에 수행한 트렌드 검색 결과를 참고해서 답변해야 합니다.\n"
            "답변 마지막에 '참고 자료' 또는 '근거' 섹션을 두고, 검색 과정에서 활용한 URL들을 정리해 주세요.\n"
        )

    return SystemMessage(content=system_content)


async def stream_brand_chat(
    brand_graph,
    config: Dict[str, Any],
    state: AppState,
    brand_session_id: str,
    db: Session,
    current_user: UserInfo,
) -> AsyncGenerator[str, None]:
    """
    브랜드 챗 스트리밍 처리.
    그래프 실행 및 LLM 스트리밍을 처리하고, 최종적으로 프로젝트 저장까지 수행.
    """
    try:
        # 세션 ID 전송
        yield f"data: {json.dumps({'type': 'session', 'brand_session_id': brand_session_id})}\n\n"

        llm = get_fast_chat_model()
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
                    messages: list = list(intermediate_state.get("messages") or [])
                    brand_profile = intermediate_state.get("brand_profile") or {}
                    meta: dict = dict(intermediate_state.get("meta") or {})
                    trend_context: dict = dict(intermediate_state.get("trend_context") or {})

                    # 시스템 프롬프트 생성
                    system = build_brand_chat_system_prompt(
                        brand_profile=brand_profile,
                        meta=meta,
                        trend_context=trend_context,
                    )

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
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        yield "data: " + json.dumps({"type": "error", "message": error_msg}, ensure_ascii=False) + "\n\n"