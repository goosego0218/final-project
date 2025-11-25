# 채팅 스키마
# 작성자: 황민준
# 작성일: 2025-11-18
# 수정내역
# - 2025-11-18: 초기 작성
# - 2025-11-19: response 스키마 추가
# - 2025-11-23: ShortsResume 스키마 추가

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
    brand_info: Optional[dict] = None  # BrandProfile 정보


class CreateBrandProjectRequest(BaseModel):
    brand_session_id: str  # 필수: 세션 ID
    grp_nm: Optional[str] = None  # 프로젝트명 (없으면 brand_name 사용)
    grp_desc: Optional[str] = None  # 프로젝트 설명


class CreateBrandProjectResponse(BaseModel):
    project_id: int
    grp_nm: str
    grp_desc: Optional[str] = None


class LogoChatRequest(BaseModel):
    project_id: int
    message: str
    logo_type: Optional[str] = None  # 예: wordmark, symbol_plus_text, emblem
    trend_choice: Optional[str] = None  # 예: 타입별 트렌드 선택값
    logo_session_id: Optional[str] = None


class LogoChatResponse(BaseModel):
    reply: str
    project_id: int
    logo_session_id: str
    brand_profile: Optional[dict] = None
    reference_image: Optional[str] = None
    reference_candidates: Optional[list[str]] = None


class ShortsChatRequest(BaseModel):
    project_id: int
    message: Optional[str] = None
    shorts_session_id: Optional[str] = None


class ShortsChatResponse(BaseModel):
    reply: str
    project_id: int
    shorts_session_id: str


class ShortsResumeRequest(BaseModel):
    project_id: int
    shorts_session_id: str
    answer: str  # "Y" or "N"


class ShortsResumeResponse(BaseModel):
    reply: str
    project_id: int
    shorts_session_id: str
