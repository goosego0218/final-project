"""트렌드 추천을 생성하는 서브 에이전트 틀."""

from __future__ import annotations

from typing import Any, Dict


def generate_trend_recommendations(seed: Dict[str, Any]) -> Dict[str, Any]:
    """
    서브 에이전트가 트렌드 추천을 생성해야 합니다.
    현재는 구현되지 않아 빈 추천을 반환합니다.
    """
    return {
        "reco_tone": seed.get("tone"),
        "reco_keywords": seed.get("keywords") or [],
        "reco_colors": seed.get("colors") or [],
        "reco_slogan": seed.get("slogan") or "",
        "notes": ["트렌드 서브 에이전트가 아직 구현되지 않았습니다."],
    }

