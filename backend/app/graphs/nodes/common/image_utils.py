# 이미지 처리 공통 유틸리티
# 작성일: 2025-12-04
# 수정내역
# - 2025-12-04: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Optional, List

if TYPE_CHECKING:
    from app.agents.state import AppState
    from langchain_core.messages import BaseMessage


def extract_images_from_messages(messages: List["BaseMessage"]) -> List[str]:
    """
    메시지 리스트에서 이미지(Base64)를 추출하는 공통 함수.
    
    Args:
        messages: LangChain 메시지 리스트
        
    Returns:
        Base64 인코딩된 이미지 문자열 리스트 (data:image/... 형식 포함 가능)
    """
    images = []
    for msg in messages:
        # HumanMessage에서 이미지 추출
        if hasattr(msg, 'type') and msg.type == "human":
            # content가 리스트인 경우 (멀티모달)
            if isinstance(msg.content, list):
                for item in msg.content:
                    if isinstance(item, dict) and item.get("type") == "image_url":
                        image_url = item.get("image_url", {})
                        if isinstance(image_url, dict):
                            image_data = image_url.get("url", "")
                        elif isinstance(image_url, str):
                            image_data = image_url
                        else:
                            image_data = ""
                        
                        if image_data:
                            images.append(image_data)
            # content가 문자열이고 data:image 형식인 경우
            elif isinstance(msg.content, str) and msg.content.startswith("data:image"):
                images.append(msg.content)
    
    return images


def get_first_image_from_state(state: "AppState") -> Optional[str]:
    """
    State에서 첫 번째 이미지를 추출하는 헬퍼 함수.
    
    Args:
        state: AppState
        
    Returns:
        첫 번째 이미지의 Base64 문자열 또는 None
    """
    messages = state.get("messages", [])
    images = extract_images_from_messages(messages)
    return images[0] if images else None
