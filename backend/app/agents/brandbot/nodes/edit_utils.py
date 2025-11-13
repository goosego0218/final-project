"""편집 흐름에서 사용하는 공통 유틸리티."""

from __future__ import annotations

from typing import Any, Iterable, List

LIST_FIELDS = {"keywords", "avoid_trends", "colors"}

FIELD_LABELS = {
    "name": "브랜드명",
    "industry": "업종",
    "tone": "톤/분위기",
    "keywords": "키워드",
    "target_age": "타깃 연령",
    "target_gender": "타깃 성별",
    "avoid_trends": "기피 트렌드",
    "slogan": "슬로건",
    "colors": "선호 색상",
}


def format_value(value: Any) -> str:
    """사용자 메시지용 값을 문자열로 정리."""
    if value is None:
        return "없음"
    if isinstance(value, (list, tuple, set)):
        items = [str(v).strip() for v in value if str(v).strip()]
        return ", ".join(items) if items else "없음"
    text = str(value).strip()
    return text or "없음"


def ensure_list(value: Any) -> List[str]:
    """값을 문자열 리스트로 정규화."""
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, Iterable):
        out: List[str] = []
        for item in value:
            text = str(item).strip()
            if text and text not in out:
                out.append(text)
        return out
    text = str(value).strip()
    return [text] if text else []

