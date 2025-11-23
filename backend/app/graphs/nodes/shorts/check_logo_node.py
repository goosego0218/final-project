# 로고 사용 여부 체크 노드
# 작성자 : 주후상
# 작성일: 2025-11-22
# 수정내역
# - 2025-11-22: 인터럽트 로직 및 분기 처리 추가
# - 2025-11-22: interrupt() 직접 호출로 수정

from __future__ import annotations
from typing import TYPE_CHECKING, Literal

from langchain_core.messages import SystemMessage, AIMessage
from langgraph.types import Command, interrupt
from langgraph.graph import END

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.language_models.chat_models import BaseChatModel

def make_check_logo_node(llm: "BaseChatModel"):
    """
    로고 사용 여부 체크 노드 팩토리.
    - llm을 사용하여 사용자에게 질문 메시지 생성
    """
    def check_logo_node(state: "AppState") -> dict | Command[Literal["fetch_logo", "generate_prompt_no_logo"]]:
        """
        로고 사용 여부 체크 노드 (인터럽트)
        
        역할:
        - 사용자에게 로고 사용 여부를 질문
        - 인터럽트를 통해 사용자 입력 대기
        - 선택에 따라 다음 노드로 분기
        
        흐름:
        - check_logo_node -> 사용자입력(인터럽트 발생)
        - 사용자 입력 → logo_usage_choice 업데이트
        - use_existing → fetch_logo_node
        - without_logo → generate_prompt_node (로고 없음)
        """
        shorts_state = dict(state.get("shorts_state") or {})
        if shorts_state.get("logo_usage_choice"):
            choice = shorts_state["logo_usage_choice"]
            if choice == "use_existing":
                return Command(goto="fetch_logo")
            elif choice == "without_logo":
                return Command(goto="generate_prompt_no_logo")
            else:
                raise ValueError(f"Unexpected logo_usage_choice: {choice}")


        # 사용자에게 질문 메시지 추가
        question_msg = AIMessage(
            content=("기존 로고를 사용하시겠습니까?\n\n"
                    "Y: 기존 로고 사용\n"
                    "N: 로고 없이 진행")
        )
        # 메시지 추가 후 인터럽트 발생
        # 사용자가 logo_usage_choice를 업데이트할 때까지 대기
        # 여기서 interrupt는 "질문만 띄우고 멈춘다"
        choice = interrupt({
            "messages": [question_msg],
        })

        # 재개되면 위 interrupt()가 리턴값을 돌려줌 (예: "Y" / "N")
        # 또다른 인터럽트시에는 그쪽 노드에서 조건문으로 받아서 사용하면될듯
        # 여기서 바로 해석해서 state 업데이트 + 분기
        if isinstance(choice, str):
            upper = choice.upper()
            if upper == "Y":
                return Command(
                    update={"shorts_state": {**shorts_state, "logo_usage_choice": "use_existing"}},
                    goto="fetch_logo",
                )
            elif upper == "N":
                return Command(
                    update={"shorts_state": {**shorts_state, "logo_usage_choice": "without_logo"}},
                    goto="generate_prompt_no_logo",
                )

        raise ValueError(f"Unexpected resume value from interrupt: {choice}")

    return check_logo_node
