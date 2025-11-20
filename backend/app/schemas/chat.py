# 채팅 스키마
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: response 스키마 추가

from typing import List, Optional, Literal
from pydantic import BaseModel

class ChatRequest(BaseModel):
    project_id: Optional[int] = None         # 어떤 프로젝트(브랜드)인가
    message: str                       # 이번 턴 유저 발화 한 줄
    grp_nm: Optional[str] = None
    grp_desc: Optional[str] = None
    brand_session_id: Optional[str] = None
    logo_session_id: Optional[str] = None
    shorts_session_id: Optional[str] = None    

class ChatResponse(BaseModel):
    reply: str                               # 이번 턴 모델 답변
    project_id: Optional[int] = None         # 프로젝트 id -> 브랜드 챗봇은 대화 끝나면 id가 새로 생성되기 때문
    brand_session_id: Optional[str] = None
    logo_session_id: Optional[str] = None
    shorts_session_id: Optional[str] = None    

#### 
class BrandChatRequest(BaseModel): 
    message: str                      
    grp_nm: Optional[str] = None
    grp_desc: Optional[str] = None
    brand_session_id: Optional[str] = None

class BrandChatResponse(BaseModel):
    reply: str                               
    project_id: Optional[int] = None        
    brand_session_id: Optional[str] = None