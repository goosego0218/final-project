from typing import List
from brandbot.state import SessionState
from brandbot.utils.tracing import log_state  # 디버그 로그

# 표시/검증 설정
_REQUIRED = ["name", "industry"]
_OPTIONAL = ["tone", "keywords", "target_age", "target_gender", "colors", "avoid_trends", "slogan"]

_LABEL_KR = {
    "name": "브랜드명",
    "industry": "업종",
    "tone": "분위기",
    "keywords": "핵심 키워드",
    "colors": "선호 색상",
    "target_age": "타깃 연령대",
    "target_gender": "타깃 성별",
    "avoid_trends": "기피 트렌드",
    "slogan": "슬로건",
}

def _has_value(v) -> bool:
    if v is None:
        return False
    if isinstance(v, (list, tuple, set)):
        return len(v) > 0
    if isinstance(v, str):
        return bool(v.strip())
    return True

def _fmt_list(values: List[str]) -> str:
    return ", ".join(map(str, values))

def _mk_summary_lines(d: dict) -> List[str]:
    lines: List[str] = ["지금까지 정리한 기획 초안입니다."]

    # 필수
    if _has_value(d.get("name")):
        lines.append(f"• {_LABEL_KR['name']}: {d['name']}")
    if _has_value(d.get("industry")):
        lines.append(f"• {_LABEL_KR['industry']}: {d['industry']}")

    # 선택 (입력된 항목)
    if _has_value(d.get("tone")):
        lines.append(f"• {_LABEL_KR['tone']}: {d['tone']}")
    if _has_value(d.get("keywords")):
        lines.append(f"• {_LABEL_KR['keywords']}: {_fmt_list(d['keywords'])}")
    if _has_value(d.get("target_age")):
        lines.append(f"• {_LABEL_KR['target_age']}: {d['target_age']}")
    if _has_value(d.get("target_gender")):
        lines.append(f"• {_LABEL_KR['target_gender']}: {d['target_gender']}")
    if _has_value(d.get("colors")):
        lines.append(f"• {_LABEL_KR['colors']}: {_fmt_list(d['colors'])}")
    if _has_value(d.get("avoid_trends")):
        lines.append(f"• {_LABEL_KR['avoid_trends']}: {_fmt_list(d['avoid_trends'])}")
    if _has_value(d.get("slogan")):
        lines.append(f"• {_LABEL_KR['slogan']}: {d['slogan']}")

    # 남은 항목 (입력되지 않은 옵션 항목들)
    missing_optional = [k for k in _OPTIONAL if not _has_value(d.get(k))]
    if missing_optional:
        missing_labels = [_LABEL_KR[k] for k in missing_optional]
        lines.append("")
        lines.append(f"남은 항목: {', '.join(missing_labels)}")

    return lines

def _mk_reco_lines(recos: dict) -> List[str]:
    if not recos:
        return []
    lines: List[str] = ["", "— 트렌드 추천 —"]
    if _has_value(recos.get("reco_tone")):
        lines.append(f"• 추천 분위기: {recos['reco_tone']}")
    if _has_value(recos.get("reco_keywords")):
        lines.append("• 추천 핵심 키워드: " + _fmt_list(recos["reco_keywords"][:6]))
    if _has_value(recos.get("reco_colors")):
        lines.append("• 추천 색상: " + _fmt_list(recos["reco_colors"][:6]))
    if _has_value(recos.get("reco_slogan")):
        lines.append(f"• 추천 슬로건: {recos['reco_slogan']}")
    for n in (recos.get("notes") or [])[:3]:
        lines.append(f"  - {n}")
    return lines

# 레거시 호환: trend_brief
def _mk_trend_brief_lines(trend: dict) -> List[str]:
    if not trend:
        return []
    lines: List[str] = ["", "— 트렌드 제안 —"]
    if _has_value(trend.get("copy_tone")):
        lines.append(f"• 카피 톤(제안): {trend['copy_tone']}")
    if _has_value(trend.get("logo_style")):
        lines.append(f"• 로고 스타일(제안): {trend['logo_style']}")
    notes = trend.get("notes") or []
    for n in notes:
        if "자료가 없습니다" in n or "없습니다" in n:
            continue
        lines.append(f"  - {n}")
        if len(lines) >= 1 + 1 + 1 + 2:
            break
    return lines

def _mk_followups(required_missing: List[str]) -> List[str]:
    if required_missing:
        missing_labels = [_LABEL_KR[k] for k in required_missing]
        return [
            "",
            f"아직 필수 항목이 부족합니다: {', '.join(missing_labels)}",
            "예) '브랜드명은 ○○', '업종은 카페'",
            "원하시면 '분위기', '키워드', '색상 추천', '슬로건 추천', '타깃 추천'처럼 요청하실 수도 있어요.",
        ]
    return [
        "",
        "다음 중 원하시는 걸 말씀해 주세요:",
        "1) ‘이대로 확정’ → 프로젝트 생성",
        "2) ‘최신 트렌드 알려줘’ → 업종/분위기 기반 최신 트렌드",
        "3) ‘최신 트렌드 재추천’ → 트렌드 추천 다시 받기",
        "",
        "또는 기존 값을 수정하고 싶으시면 직접 말씀해 주세요:",
        "예) '브랜드명을 ○○으로 변경', '분위기를 차분하게', '키워드에 친근함 추가'",
    ]

async def snapshot_review(state: SessionState) -> SessionState:
    draft = state.get("brand_draft") or {}
    recos = state.get("trend_recos") or {}     # 추천 4종
    brief = state.get("trend_brief") or {}     # 레거시
    trend_ready = bool(state.get("_trend_ready"))  # 이번 턴만 노출

    log_state(state, "snapshot_review:input",
              has_recos=bool(recos), has_brief=bool(brief), trend_ready=trend_ready)

    lines = _mk_summary_lines(draft)

    # 추천은 이번 턴에 요청/수정/적용 직후에만 노출
    if trend_ready and recos:
        lines.extend(_mk_reco_lines(recos))
    elif trend_ready and not recos and brief:
        # 레거시 브리프가 있으면 fallback
        lines.extend(_mk_trend_brief_lines(brief))

    # 필수 충족 여부
    missing_required = [k for k in _REQUIRED if not _has_value(draft.get(k))]
    lines.extend(_mk_followups(missing_required))

    text = "\n".join(lines)
    log_state(state, "snapshot_review:output",
              text_preview=text[:160] + ("..." if len(text) > 160 else ""))

    # 표시 후 플래그 리셋하여 다음 턴에는 자동 노출되지 않게 함
    return {"snapshot_text": text, "_trend_ready": False}