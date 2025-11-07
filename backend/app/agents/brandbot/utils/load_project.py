# src/brandbot/utils/load_project.py
"""
다음 에이전트에서 확정된 프로젝트 state를 불러오는 유틸리티
Chroma 벡터 DB에서 state를 불러옵니다.
"""
from typing import Optional
from brandbot.state import SessionState

def load_project_state(project_id: str) -> Optional[SessionState]:
    """
    project_id로 Chroma 벡터 DB에 저장된 state를 불러옵니다.
    
    사용 예시:
        state = load_project_state("proj_1043eb6a")
        if state:
            # 다음 에이전트에서 state 사용
            shortform_agent = ShortformAgent(state)
    """
    try:
        from brandbot.vector.indexers import load_state_from_chroma
        
        state_dict = load_state_from_chroma(project_id)
        
        if state_dict:
            return state_dict  # type: ignore
        
        return None
    except Exception as e:
        # 로깅 필요
        return None

