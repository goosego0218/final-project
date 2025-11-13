# src/brandbot/nodes/trend_gate.py
from __future__ import annotations
import re
from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM
from brandbot.utils.tracing import log_state

TREND_TRIGGERS = (
    "트렌드 알려줘", "트렌드 알려줘봐", "트렌드", "trend",
    "요즘", "최근", "톤앤매너", "스타일 가이드"
)
CONFIRM_TRIGGERS = (
    "이대로 확정", "확정할게", "프로젝트 생성", "프로젝트 만들어",
    "최종 확정", "완료해", "finalize"
)
REVIEW_TRIGGERS = (
    "정리", "요약", "지금까지", "현재까지", "요약 보여줘", "정리된 거"
)
OPT_TRIGGERS = (
    "추천", "색상 추천", "슬로건 추천", "카피 추천",
    "타깃 추천", "연령 추천", "성별 추천", "기피", "피하고 싶은"
)
APPLY_TRIGGERS = ("추천 적용", "이대로 적용", "추천 반영", "적용해")

# 업종/필수 필드 암시 표현 간단 감지
_INDUSTRY_HINT = re.compile(r"(카페|베이커리|패션|식당|음식점|F&B|IT|헬스|미용|디저트|커피)")
_NAME_HINT = re.compile(r"(브랜드\s*명|브랜드명|상호|이름)")
_TONE_HINT = re.compile(r"(분위기|톤)")
_KEYWORDS_HINT = re.compile(r"(키워드|키워드는|키워드가)")
_TARGET_HINT = re.compile(r"(타깃|타겟|타겟은|타깃은|타겟이|타깃이)")
_TARGET_AGE_HINT = re.compile(r"(\d+대|연령|연령대|나이)")
_TARGET_GENDER_HINT = re.compile(r"(남성|여성|남자|여자|성별)")
_SLOGAN_HINT = re.compile(r"(슬로건|슬로건은|슬로건이|태그라인)")
_COLORS_HINT = re.compile(r"(색상|색깔|컬러|색|색은|색이|색상은|색상이)")
_AVOID_HINT = re.compile(r"(기피|피하고|싫어|안 좋아|싫은)")
_ENDING_PARTICLE = re.compile(r"(임|입니다|이에요|이야)\s*$")

def _has_any(text: str, keys: tuple[str, ...]) -> bool:
    low = text.lower()
    return any(k in text or k in low for k in keys)

def _looks_like_field_update(text: str) -> bool:
    # 명시 패턴이 있거나 업종/톤/키워드 단어 등장, 혹은 업종 단어 + 종결어미 조합 등
    if _NAME_HINT.search(text): return True
    if _TONE_HINT.search(text): return True
    if _KEYWORDS_HINT.search(text): return True
    if _INDUSTRY_HINT.search(text): return True
    if _TARGET_HINT.search(text): return True
    if _TARGET_AGE_HINT.search(text): return True
    if _TARGET_GENDER_HINT.search(text): return True
    if _SLOGAN_HINT.search(text): return True
    if _COLORS_HINT.search(text): return True
    if _AVOID_HINT.search(text): return True
    # "카페임" 같은 케이스
    if _INDUSTRY_HINT.search(_ENDING_PARTICLE.sub("", text)):
        return True
    return False

def _required_ok(state: SessionState) -> bool:
    draft = state.get("brand_draft") or {}
    # 필수 항목: name, industry만
    return bool(draft.get("name")) and bool(draft.get("industry"))

async def trend_gate(state: SessionState) -> SessionState:
    pending = state.get("pending_edit") or {}
    if pending.get("status") == "awaiting_choice":
        log_state(state, "intent_gate", scope="in", intent="edit_choice", reason="pending_edit_choice")
        return {"_intent": "edit_choice"}

    text = (last_user_text(state) or "").strip()

    # 0) 필드 업데이트로 보이면 수집 우선
    if _looks_like_field_update(text):
        log_state(state, "intent_gate", scope="in", intent="collect", reason="field_update_detected")
        return {"_intent": "collect"}

    # 1) 키워드 트리거
    if _has_any(text, APPLY_TRIGGERS):
        log_state(state, "intent_gate", scope="in", intent="apply_recos", trigger="APPLY")
        return {"_intent": "apply_recos"}
    if _has_any(text, TREND_TRIGGERS):
        log_state(state, "intent_gate", scope="in", intent="trend", trigger="TREND")
        return {"_intent": "trend"}
    if _has_any(text, CONFIRM_TRIGGERS):
        # 필수값 미충족이면 확정 대신 수집으로 다운그레이드
        if not _required_ok(state):
            log_state(state, "intent_gate", scope="in", intent="collect", trigger="CONFIRM_DOWNGRADED")
            return {"_intent": "collect"}
        log_state(state, "intent_gate", scope="in", intent="confirm", trigger="CONFIRM")
        return {"_intent": "confirm"}
    if _has_any(text, REVIEW_TRIGGERS):
        log_state(state, "intent_gate", scope="in", intent="review", trigger="REVIEW")
        return {"_intent": "review"}
    if _has_any(text, OPT_TRIGGERS):
        log_state(state, "intent_gate", scope="in", intent="opt_reco", trigger="OPT")
        return {"_intent":"opt_reco"}

    # 2) LLM 분류 결과
    try:
        llm = LLM()
        inferred = await llm.classify_intent(text)
    except Exception:
        inferred = "collect"

    # inferred가 confirm이어도 필수 미충족이면 collect로 강등
    if inferred == "confirm" and not _required_ok(state):
        log_state(state, "intent_gate", scope="in", intent="collect", reason="llm_confirm_downgraded")
        return {"_intent":"collect"}

    if inferred in ("trend", "confirm", "review"):
        log_state(state, "intent_gate", scope="in", intent=inferred, reason="llm_inferred")
        return {"_intent": inferred}

    log_state(state, "intent_gate", scope="in", intent="collect", reason="default")
    return {"_intent": "collect"}
