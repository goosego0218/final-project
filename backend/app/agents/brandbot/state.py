# src/brandbot/state.py
from __future__ import annotations

from datetime import datetime
from typing import (
    Annotated,
    Any,
    Dict,
    List,
    Literal,
    Optional,
    TypedDict,
)

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from brandbot.config import SETTINGS


# ─────────────────────────────────────────────────────────────────────────────
# Reducers
# ─────────────────────────────────────────────────────────────────────────────
def deep_merge(prev: Optional[Dict[str, Any]], inc: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Flexible(JSON merge) 리듀서.
    - dict ↔ dict: 재귀 병합
    - 그 외(리스트/원자): inc로 덮어쓰기
    """
    base = dict(prev or {})
    src = inc or {}
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            base[k] = deep_merge(base[k], v)
        else:
            base[k] = v
    return base


def now_utc_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


# ─────────────────────────────────────────────────────────────────────────────
# 타입 정의
# ─────────────────────────────────────────────────────────────────────────────
VectorBackend = Literal["faiss", "chroma"]
RdbDriver = Literal["sqlite", "oracle"]


# ─────────────────────────────────────────────────────────────────────────────
# Session State
#  - messages: Annotated + add_messages (LangGraph 권장)
#  - brand_draft: deep_merge 리듀서로 자연발화 수집값 점진 병합
#  - Dual Storage: VectorDB(FAISS/Chroma) + RDB(SQLite→Oracle) 메타 포함
# ─────────────────────────────────────────────────────────────────────────────
class SessionState(TypedDict, total=False):
    # 1) 대화/수집
    messages: Annotated[List[AnyMessage], add_messages]   # 히스토리 자동 누적
    brand_draft: Annotated[Dict[str, Any], deep_merge]    # 자유 입력 초안(LLM 추출 결과 누적)
    brand_profile: Dict[str, Any]                         # 확정 스냅샷(정제된 프로필)
    brand_strategy: Dict[str, Any]                        # 전략(콘셉트/핵심가치/톤앤매너 등)
    trend_brief: Dict[str, Any]                           # 트렌드 요약(JSON)
    snapshot_text: str                                    # 사용자에게 보여줄 요약 문장
    pending_edit: Annotated[Dict[str, Any], deep_merge]   # 수정 확인 대기 항목
    edit_choice_retry: bool                               # 수정 옵션 안내 재요청 여부

    # 2) 리서치(검색) 계획/결과
    research_plan: List[Dict[str, Any]]                   # 생성된 쿼리 계획
    research_results: List[Dict[str, Any]] | Dict[str, Any]

    # 3) Dual Storage 설정
    # VectorDB
    vector_backend: VectorBackend                         # "faiss" | "chroma"
    vector_namespace: str                                 # 프로젝트별 컬렉션/네임스페이스
    embedding_model: str                                  # 예: "text-embedding-3-small"
    embedding_dim: int                                    # 예: 1536
    to_vectorize: List[Dict[str, Any]]                    # 인덱싱 대기 큐 [{"doc_id","text","metadata"}]
    doc_refs: List[str]                                   # 저장된 문서 id 추적

    # RDB (개발: SQLite, 운영: Oracle)
    rdb_driver: RdbDriver                                 # "sqlite" | "oracle"
    rdb_dsn: str                                          # sqlite 파일경로 또는 Oracle DSN
    rdb_schema_version: str                               # 마이그레이션 버전 태그

    # 4) 세션/프로젝트 메타
    session_id: str
    project_id: Optional[str]
    confirmed: bool
    created_at: str
    updated_at: str

    # 5) 제어/에러
    _intent: Optional[str]                                # "collect" | "trend" | "confirm" | ...
    _error: Optional[str]

    trend_brief: Dict[str, Any]                           # 트렌드 요약(JSON)

    # 웹 검색 기반 추천 4종(추천 분위기/키워드/색상/슬로건 + 근거 메모)
    trend_recos: Dict[str, Any]                           # {reco_tone, reco_keywords[], reco_colors[], reco_slogan, notes[]}

    # (선택) 이번 턴에만 트렌드/추천 섹션을 강조 노출할 때 쓰는 플래그
    _trend_ready: bool

    snapshot_text: str                                    # 사용자에게 보여줄 요약 문장

# ─────────────────────────────────────────────────────────────────────────────
# 초기 상태 팩토리
# ─────────────────────────────────────────────────────────────────────────────
def initial_state() -> SessionState:
    """
    러너/엔트리포인트에서 사용할 기본 상태.
    그래프 첫 사이클 전에 주입하세요.
    환경변수(.env)에서 기본값을 읽어옵니다.
    """
    ts = now_utc_iso()
    return {
        # 대화/수집
        "messages": [],
        "brand_draft": {},
        "brand_profile": {},
        "brand_strategy": {},
        "trend_brief": {},
        "trend_recos": {},
        "_trend_ready": False,
        "snapshot_text": "",
        "pending_edit": {},
        "edit_choice_retry": False,

        # 리서치
        "research_plan": [],
        "research_results": [],

        # VectorDB 기본값 (환경변수에서 읽기)
        "vector_backend": SETTINGS.vector_backend,
        "vector_namespace": "proj_default",
        "embedding_model": SETTINGS.model_embed,
        "embedding_dim": 1536,
        "to_vectorize": [],
        "doc_refs": [],

        # RDB 기본값 (환경변수에서 읽기)
        "rdb_driver": SETTINGS.rdb_driver,
        "rdb_dsn": SETTINGS.sqlite_path,
        "rdb_schema_version": "v1",

        # 세션/프로젝트
        "session_id": "",
        "project_id": None,
        "confirmed": False,
        "created_at": ts,
        "updated_at": ts,

        # 제어
        "_intent": None,
        "_error": None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────────────────────
def touch_updated(state: SessionState) -> None:
    """노드 종료 직전에 호출해 updated_at만 갱신합니다."""
    state["updated_at"] = now_utc_iso()


def last_user_text(state: SessionState) -> str:
    """
    최근 Human 발화 텍스트를 안전하게 추출.
    노드에서 간단히 호출해 사용할 수 있습니다.
    """
    msgs = state.get("messages") or []
    for m in reversed(msgs):
        # langchain_core.messages의 message.type 값은 "human"/"ai"/"tool" 등
        if getattr(m, "type", None) == "human":
            return getattr(m, "content", "") or ""
    return ""
