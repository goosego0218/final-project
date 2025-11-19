# 에이전트 상태 정의
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성
# - 2025-11-19: LangChain AgentState 적용

from __future__ import annotations

from typing import Literal, Optional, Dict, Any
from typing_extensions import TypedDict

<<<<<<< HEAD
# from langgraph.graph import MessagesState
=======
from langgraph.graph import MessagesState
>>>>>>> e62ecbc4100ab360ddc806c7f0e747302cbb9499
from langchain.agents import AgentState

class BrandProfile(TypedDict, total=False):
    """
    브랜드(프로젝트) 기본 정보.
    - 브랜드 챗봇이 대화를 통해 점점 채워나갈 필드들.
    - 아직 수집 안 된 값은 키 자체가 없을 수 있게 total=False.
    """
    brand_name: str                # 브랜드 명
    category: str                  # 업종 카테고리 (카페, 음식점, 패션 등)
    tone_mood: str                 # 브랜드 톤/무드 (힙한, 고급스러운 등)
    core_keywords: str             # 핵심 키워드 (콤마/슬래시 등으로 묶어서 문자열로 관리)
    slogan: str                    # 슬로건
    target_age: str                # 타깃 연령대 (예: "20-30", "10대 후반" 등 자유 텍스트)
    target_gender: str             # 타깃 성별 (예: "여성 위주", "남녀공용" 등)
    avoided_trends: str            # 기피 트렌드/분위기
    preferred_colors: str          # 선호 색상/색감 설명
    # 파일 업로드(로고/캐릭터)는 DB나 별도 파일 스토리지 경로로 관리할 예정


class ProjectDraft(TypedDict, total=False):
    """
    아직 DB prod_grp 에 INSERT 되지 않은 '프로젝트(폴더) 초안' 정보.
    - grp_nm, grp_desc 는 폴더 관리용 메타데이터일 뿐,
      브랜드 이름(brand_name)과는 별개다.
    """
    grp_nm: str                    # 프로젝트 폴더 이름
    grp_desc: Optional[str]        # 프로젝트 설명
    creator_id: Optional[int]      # 초안을 만든 유저 id

class TrendContext(TypedDict, total=False):
    """
    트렌드 분석 관련해서 공통으로 쓰일 컨텍스트/캐시.
    - 각 에이전트(브랜드/로고/숏폼)가 트렌드를 호출할 때
      동일한 질의를 반복하지 않도록 캐시 역할도 할 수 있음.
    """
    last_query: Optional[str]      # 마지막으로 분석했던 질의 설명
    last_result_summary: Optional[str]  # 요약 결과(LLM가 만든 자연어)
    # 필요하면 키워드별 캐시, 플랫폼별 트렌드 등 확장 가능
    # e.g. "by_platform": {"instagram": "...", "tiktok": "..."}

class AppState(AgentState):
    """
    전체 그래프 공유할 공통 상태 스키마.
    LangGraph의 MessagesState를 상속하면
    - messages: List[AnyMessage] 필드가 자동 포함된다.
    """

    # 현재 대화 모드 (어느 챗봇이 메인인지)
    mode: Literal["brand", "logo", "shorts"] 

    # 프로젝트/브랜드 식별자
    # - 아직 DB에 생성 전이면 None일 수 있음
    project_id: Optional[int]

    # 프로젝트 폴더 정보
    # 프로젝트명, 프로젝트 설명 -> 로고와 쇼츠 에이전트에선 쓰지 않는다.
    project_draft: ProjectDraft

    # 브랜드 기본 정보 (브랜드 챗봇이 채운다)
    brand_profile: BrandProfile

    # 트렌드 분석 관련 캐시/컨텍스트
    trend_context: TrendContext

    # 추가로 메타데이터 보관용 (필요 시 확장)
    meta: Dict[str, Any]