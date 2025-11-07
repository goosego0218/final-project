# src/brandbot/utils/search.py
from __future__ import annotations
from typing import List, Dict, Any
import os

try:
    from tavily import TavilyClient
except Exception:
    TavilyClient = None  # 설치 전에도 임포트 에러 안 나게

class TavilySearch:
    def __init__(self, api_key: str | None = None):
        key = api_key or os.getenv("TAVILY_API_KEY")
        if not key:
            raise RuntimeError("TAVILY_API_KEY 가 설정되지 않았습니다 (.env 확인).")
        if TavilyClient is None:
            raise RuntimeError("tavily-python 패키지가 설치되어야 합니다. (pip/uv 설치)")
        self.client = TavilyClient(api_key=key)

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        반환 형식: [{title, url, content}, ...]
        """
        resp = self.client.search(
            query=query,
            search_depth="advanced",
            max_results=int(k),
            include_domains=None,
            include_answer=False,
            include_raw_content=True,
            include_images=False,
        )
        results = []
        for r in resp.get("results", []):
            results.append({
                "title": r.get("title"),
                "url": r.get("url"),
                "content": r.get("raw_content") or r.get("content") or "",
            })
        return results

def build_trend_query(draft: dict) -> str:
    """
    초안(draft)에서 업종/톤/타깃/키워드/색상/기피트렌드/슬로건 기반으로 한국어 검색 쿼리 생성
    """
    industry = draft.get("industry") or ""
    tone = draft.get("tone") or ""
    age = draft.get("target_age") or ""
    gender = draft.get("target_gender") or ""
    kws = ", ".join(draft.get("keywords") or []) or ""
    colors = ", ".join(draft.get("colors") or []) or ""
    avoid_trends = ", ".join(draft.get("avoid_trends") or []) or ""
    slogan = draft.get("slogan") or ""

    parts = []
    if industry: parts.append(f"{industry} 브랜드 트렌드")
    if tone:     parts.append(f"톤앤매너 {tone}")
    if kws:      parts.append(f"키워드 {kws}")
    if age or gender: parts.append(f"타깃 {age} {gender}".strip())
    if colors:   parts.append(f"색상 {colors}")
    if avoid_trends: parts.append(f"기피 트렌드 {avoid_trends}")
    if slogan:   parts.append(f"슬로건 컨셉 {slogan[:50]}")  # 슬로건은 길 수 있으니 앞부분만

    # 디자인/콘텐츠 축 보강 키워드
    parts.append("로고 디자인 트렌드")
    parts.append("색상 팔레트 트렌드")
    parts.append("카피라이팅 톤 최근 경향")
    return " / ".join(p for p in parts if p)
