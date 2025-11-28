"""
가드레일 체크 노드
사용자 입력 안전성 검사 (intent 노드 이전에 실행)
"""

from typing import TYPE_CHECKING
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.types import Command
from langgraph.graph import END

if TYPE_CHECKING:
    from app.agents.state import AppState


def make_safeguard_check_node():
    """
    사용자 입력 가드레일 체크 노드
    
    설정에서 safeguard_enabled=False면 바로 통과
    유해 입력이면 바로 END로 종료
    """
    from app.core.config import settings
    from app.guardrails.kanana_safeguard import get_safeguard_instance
    
    # 설정이 꺼져있으면 바로 통과하는 노드 반환
    if not getattr(settings, 'safeguard_enabled', False):
        def bypass_node(state: "AppState") -> "AppState":
            return state
        return bypass_node
    
    # 가드레일 인스턴스 (한 번만 로드)
    safeguard = get_safeguard_instance("general")
    
    def check_safeguard(state: "AppState") -> "AppState" | Command:
        """사용자 입력 안전성 체크"""
        messages = state.get("messages", [])
        
        if not messages:
            return state
        
        # 마지막 메시지가 사용자 입력인지 확인
        last_message = messages[-1]
        
        if isinstance(last_message, HumanMessage):
            user_input = last_message.content
            
            # 안전성 검사
            result = safeguard.check(user_input)
            
            if not result["is_safe"]:
                # 유해 입력 발견 - 차단 메시지 반환하고 종료
                blocked_message = AIMessage(
                    content="죄송합니다. 부적절한 내용이 감지되어 응답할 수 없습니다. 다른 질문을 해주시겠어요?"
                )
                
                # 메타데이터에 가드레일 정보 저장
                if "meta" not in state:
                    state["meta"] = {}
                state["meta"]["safeguard_blocked"] = True
                state["meta"]["risk_code"] = result.get("risk_code")
                state["meta"]["blocked_input"] = user_input[:100]  # 디버깅용 (일부만)
                
                # 차단 메시지 추가하고 바로 종료
                return Command(
                    update={
                        "messages": [blocked_message],
                        "meta": state["meta"]
                    },
                    goto=END
                )
        
        # 안전한 입력이면 그대로 통과 (다음 노드로)
        return state
    
    return check_safeguard

