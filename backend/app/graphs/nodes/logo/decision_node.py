# 로고 의도 분류 노드
# 작성일: 2025-12-05

from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import Command

from app.graphs.nodes.logo.prompts import LOGO_DECISION_SYSTEM_PROMPT

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel


def make_logo_decision_node(llm: "BaseChatModel"):
    """
    로고 에이전트 의도 분류 노드 팩토리
    """
    def decision_node(state: "AppState") -> Command[Literal["generate_logo_prompt", "logo_general_chat", "logo_trend_analysis"]]:
        """
        분기 판단 노드: LLM이 사용자 의도를 파악하여 세 갈래로 분기
        - generate_logo: 로고 생성/수정
        - general_chat: 일반 대화
        - trend_analysis: 트렌드 분석
        """
        # 마지막 사용자 메시지 찾기
        messages = state.get("messages", [])
        last_user_message = None
        for m in reversed(messages):
            if isinstance(m, HumanMessage):
                last_user_message = m
                break
        
        if last_user_message is None:
            return Command(goto="logo_general_chat")
        
        # 이미지가 업로드된 경우 무조건 로고 생성으로 분기
        logo_state = dict(state.get("logo_state") or {})
        if logo_state.get("ref_mode") == "user_upload" and logo_state.get("reference_images"):
            print("의도 분석: 이미지 업로드 감지 → generate_logo")
            return Command(goto="generate_logo_prompt")
        
        # LLM으로 의도 분류
        prompt_messages = [
            SystemMessage(content=LOGO_DECISION_SYSTEM_PROMPT),
            last_user_message
        ]
        response = llm.invoke(prompt_messages)
        content = response.content.lower().strip()
        
        print(f"의도 분석 결과: {content}")
        
        # 분기 로직
        if "generate_logo" in content:
            return Command(goto="generate_logo_prompt")
        elif "general_chat" in content:
            return Command(goto="logo_general_chat")
        elif "trend_analysis" in content:
            return Command(goto="logo_trend_analysis")
        
        # 기본값: 로고 생성 (애매하면 생성으로)
        return Command(goto="generate_logo_prompt")
    
    return decision_node