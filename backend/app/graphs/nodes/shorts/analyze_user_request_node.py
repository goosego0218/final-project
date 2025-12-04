# 숏폼 영상에 대한 요구사항을 JSON으로 추출하는 노드
# 작성일: 2025-12-03
# 수정내역
# - 2025-12-03: 초기 작성

from __future__ import annotations

import json
from typing import Dict, Any, TYPE_CHECKING

from langchain_core.messages import SystemMessage, HumanMessage
from app.agents.state import AppState

if TYPE_CHECKING:
    from langchain_core.language_models.chat_models import BaseChatModel


def make_analyze_user_request_node(llm: "BaseChatModel"):
    """
    LLM 인스턴스를 주입받아 analyze_user_request 노드를 생성하는 팩토리.
    """
    def analyze_user_request_node(state: "AppState") -> Dict[str, Any]:
        """
        사용자 발화 + 브랜드 프로필을 기반으로,
        이번 숏폼 영상에 대한 요구사항을 JSON으로 추출하는 노드.

        결과는 shorts_state.user_requirements에 저장한다.
        """

        shorts_state: Dict[str, Any] = dict(state.get("shorts_state") or {})
        brand_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})

        user_utterance: str = shorts_state.get("user_utterance") or ""
        if not user_utterance:
            # 발화가 없으면 분석할 게 없음
            return {}

        system_prompt = (
            "너는 쇼츠/릴스/틱톡 같은 숏폼 영상 기획 어시스턴트다.\n"
            "사용자의 발화와 브랜드 프로필을 보고, 이번 영상에 대한 요구사항을 "
            "JSON으로만 정리해라. 자연어 설명은 절대 쓰지 말고, 반드시 유효한 JSON만 출력해라."
        )

        human_prompt = f"""
    [사용자 발화]
    {user_utterance}

    [브랜드 프로필]
    {json.dumps(brand_profile, ensure_ascii=False, indent=2)}

    다음 키를 포함하는 JSON 객체를 만들어라:

    - purpose: 영상의 목적 (예: 신제품 홍보, 브랜드 인지도, 이벤트 홍보 등)
    - target_audience: 타겟(가능하면 구체적으로)
    - tone: 말투/분위기 (예: 밝고 경쾌, 감성적, 진중함 등)
    - visual_style: 사용자가 언급한 스타일 (예: 카툰풍, 지브리, 실사, 애니메이션 등. 없으면 null)
    - must_include: 영상에 반드시 포함되어야 하는 요소 리스트 (문구, 장면, 정보 등)
    - must_avoid: 피해야 할 요소 리스트
    - platform: 사용자가 언급한 플랫폼 (YouTube Shorts, Instagram Reels 등. 없으면 null)

    출력은 오직 하나의 JSON 객체여야 한다.
    """

        ai_msg = llm.invoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_prompt),
            ]
        )

        try:
            requirements = json.loads(ai_msg.content)
            if not isinstance(requirements, dict):
                requirements = {}
        except Exception:
            requirements = {}

        shorts_state["user_requirements"] = requirements

        return {
            "shorts_state": shorts_state,
        }
    return analyze_user_request_node