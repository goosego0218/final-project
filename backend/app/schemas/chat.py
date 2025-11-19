# 채팅 스키마
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성

from typing import List, Optional
from pydantic import BaseModel

class ChatRequest(BaseModel):
    project_id: Optional[int]          # 어떤 프로젝트(브랜드)인가
    message: str                       # 이번 턴 유저 발화 한 줄
