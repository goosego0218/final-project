# 채팅 스키마
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: response 스키마 추가

from typing import List, Optional, Literal
from pydantic import BaseModel

class BrandChatRequest(BaseModel): 
    message: str                      
    grp_nm: Optional[str] = None
    grp_desc: Optional[str] = None
    brand_session_id: Optional[str] = None

class BrandChatResponse(BaseModel):
    reply: str                               
    project_id: Optional[int] = None        
    brand_session_id: Optional[str] = None

class LogoChatRequest(BaseModel):
    project_id: int                    
    message: str
    logo_session_id: Optional[str] = None

class LogoChatResponse(BaseModel):
    reply: str
    project_id: int
    logo_session_id: str

class ShortsChatRequest(BaseModel):
    project_id: int
    message: str
    shorts_session_id: Optional[str] = None

class ShortsChatResponse(BaseModel):
    reply: str
    project_id: int
    shorts_session_id: str