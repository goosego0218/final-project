# src/brandbot/utils/llm.py
from __future__ import annotations
from typing import List, Dict, Any, Optional
import asyncio
import random

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from brandbot.config import SETTINGS
from brandbot.prompts import (
    CLASSIFY_INTENT_PROMPT,
    CLASSIFY_SCOPE_PROMPT,
    EXTRACT_KEYWORDS_FROM_SLOGAN_PROMPT,
    EXTRACT_REQUIRED_PROMPT,
    MAP_DOC_TO_BRIEF_PROMPT,
    NAME_EXPLICIT_PROMPT,
    REDUCE_DOCS_TO_RECOS_PROMPT,
    TREND_EDIT_PROMPT,
)
# 참고: schemas의 타입들은 그대로 유지
# - IntentTag, ScopeTag: Literal 타입들
# - FieldUpdate 등은 다른 노드에서 사용
from brandbot.schemas import (
    BrandSignals, TrendBrief, WebItem,
    IntentTag, ScopeTag, FieldUpdate
)

# ─────────────────────────────────────────────────────────────────────────────
# 내부 유틸
# ─────────────────────────────────────────────────────────────────────────────
def _approx_tokens(s: str) -> int:
    return max(1, int(len(s) / 4))

async def _retry_backoff(coro_fn, *, tries=3, base=0.7, jitter=0.25):
    last_err = None
    for i in range(tries):
        try:
            return await coro_fn()
        except Exception as e:
            msg = str(e).lower()
            # 요율 제한성 에러면 재시도, 그 외는 즉시 raise
            if "429" not in msg and "rate" not in msg and "limit" not in msg:
                raise
            last_err = e
            await asyncio.sleep(base * (2 ** i) + random.random() * jitter)
    raise last_err

def _shrink_items(items: List[Dict[str, Any]], k: int = 5, max_chars: int = 600) -> List[Dict[str, str]]:
    slim: List[Dict[str, str]] = []
    for it in (items or [])[:k]:
        title = (it.get("title") or "")[:120]
        snippet = (it.get("snippet") or it.get("content") or "")[:max_chars]
        url = it.get("url") or ""
        slim.append({"title": title, "snippet": snippet, "url": url})
    return slim


# ─────────────────────────────────────────────────────────────────────────────
# 구조화 스키마
# ─────────────────────────────────────────────────────────────────────────────
class RequiredExtract(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    tone: Optional[str] = None
    keywords: Optional[List[str]] = None
    target_age: Optional[str] = None
    target_gender: Optional[str] = None
    avoid_trends: Optional[List[str]] = None
    slogan: Optional[str] = None
    colors: Optional[List[str]] = None

class _KeywordsFromSlogan(BaseModel):
    keywords: List[str] = []

class TrendEdit(BaseModel):
    reco_tone: Optional[str] = None
    reco_keywords: Optional[List[str]] = None
    reco_colors: Optional[List[str]] = None
    reco_slogan: Optional[str] = None

class _DocBrief(BaseModel):
    colors: List[str] = []
    fonts: List[str] = []
    copy_tone: str = ""
    logo_style: str = ""
    notes: List[str] = []

class _BriefAgg(BaseModel):
    reco_tone: str = ""
    reco_keywords: List[str] = []
    reco_colors: List[str] = []
    reco_slogan: str = ""
    notes: List[str] = []


# ─────────────────────────────────────────────────────────────────────────────
# LLM 래퍼
# ─────────────────────────────────────────────────────────────────────────────
class LLM:
    def __init__(self, model: str | None = None, temperature: float | None = None):
        self.model_name = model or SETTINGS.model_chat
        self.temperature = SETTINGS.temperature if temperature is None else temperature
        self.llm = ChatOpenAI(model=self.model_name, temperature=self.temperature)

    # 스코프 분류: 제어/확정/요약 키워드 → in 강제
    async def classify_scope(self, text: str) -> ScopeTag:
        t = (text or "").strip().lower()

        control_kw = [
            "추천", "적용", "확정", "이대로", "프로젝트", "생성",
            "트렌드", "리뷰", "요약", "정리", "지금까지"
        ]
        if any(kw in t for kw in control_kw):
            return "in"

        brand_kw = [
            "브랜드", "브랜드명", "상호", "업종", "카테고리",
            "톤", "분위기", "키워드", "색", "색상", "로고",
            "슬로건", "타깃", "네이밍"
        ]
        if any(kw in t for kw in brand_kw):
            return "in"

        out = await (CLASSIFY_SCOPE_PROMPT | self.llm).ainvoke({"text": t})
        ans = (out.content or "").strip().lower()
        return "out" if "out" in ans else "in"

    # 의도 분류
    async def classify_intent(self, text: str) -> IntentTag:
        t = (text or "").strip().lower()
        if "트렌드" in t and ("수정" in t or "바꿔" in t or "다른" in t):
            return "trend_edit"
        if any(kw in t for kw in ["추천 적용", "이대로 적용", "추천 반영", "적용해"]):
            return "apply_recos"
        if "트렌드" in t and ("알려줘" in t or "보여줘" in t):
            return "trend"
        if any(kw in t for kw in ["이대로 확정", "확정", "프로젝트 생성"]):
            return "confirm"
        if any(kw in t for kw in ["요약", "정리", "지금까지"]):
            return "review"

        out = await (CLASSIFY_INTENT_PROMPT | self.llm).ainvoke({"text": t})
        ans = (out.content or "").strip().lower()
        for tag in ["trend_edit","apply_recos","trend","confirm","review","collect"]:
            if ans.startswith(tag):
                return tag  # type: ignore[return-value]
        return "collect"  # type: ignore[return-value]

    # 이름 명시 여부 판별: 정규식 대신 LLM 분류
    async def is_name_explicit(self, text: str) -> bool:
        out = await (NAME_EXPLICIT_PROMPT | self.llm).ainvoke({"text": text or ""})
        ans = (out.content or "").strip().lower()
        return ans.startswith("t")  # true/True

    # 필수 2종(name, industry) 및 옵션 항목 추출(정규화·요약 포함)
    async def extract_required_only(self, text: str) -> Dict[str, Any]:
        structured = self.llm.with_structured_output(RequiredExtract, method="function_calling")
        res: RequiredExtract = await (EXTRACT_REQUIRED_PROMPT | structured).ainvoke({"text": text or ""})
        data = res.model_dump(exclude_none=True)

        # keywords 후처리(중복 제거/길이 제한)
        kws = data.get("keywords")
        if isinstance(kws, str):
            kws = [kws]
        if isinstance(kws, list):
            cleaned = []
            seen = set()
            for k in kws:
                k2 = (k or "").strip()
                if not k2 or k2 in seen:
                    continue
                seen.add(k2)
                cleaned.append(k2)
            data["keywords"] = cleaned[:6] if cleaned else None

        # avoid_trends 후처리
        avoid = data.get("avoid_trends")
        if isinstance(avoid, str):
            avoid = [avoid]
        if isinstance(avoid, list):
            cleaned = []
            seen = set()
            for a in avoid:
                a2 = (a or "").strip()
                if not a2 or a2 in seen:
                    continue
                seen.add(a2)
                cleaned.append(a2)
            data["avoid_trends"] = cleaned[:6] if cleaned else None

        # colors 후처리
        colors = data.get("colors")
        if isinstance(colors, str):
            colors = [colors]
        if isinstance(colors, list):
            cleaned = []
            seen = set()
            for c in colors:
                c2 = (c or "").strip()
                if not c2 or c2 in seen:
                    continue
                seen.add(c2)
                cleaned.append(c2)
            data["colors"] = cleaned[:6] if cleaned else None

        return data

    # 슬로건에서 핵심 키워드 추출
    async def extract_keywords_from_slogan(self, slogan: str) -> List[str]:
        """
        슬로건에서 브랜드 컨셉/감성/USP/테마에 해당하는 핵심 키워드를 추출합니다.
        """
        if not slogan or not slogan.strip():
            return []

        try:
            structured = self.llm.with_structured_output(_KeywordsFromSlogan, method="function_calling")
            res: _KeywordsFromSlogan = await (EXTRACT_KEYWORDS_FROM_SLOGAN_PROMPT | structured).ainvoke(
                {"slogan": slogan.strip()}
            )
            keywords = res.keywords or []
            
            print(f"[DBG][extract_keywords_from_slogan] slogan={slogan[:60]}..., extracted={keywords}, raw_response={res}")
            
            # 키워드가 비어있으면 원본 텍스트에서 추론 시도
            if not keywords:
                print(f"[DBG][extract_keywords_from_slogan:empty] 키워드가 비어있어 fallback 시도")
                # Fallback: 간단한 키워드 추출
                fallback_keywords = []
                slogan_lower = slogan.lower()
                if "편안" in slogan_lower or "편히" in slogan_lower:
                    fallback_keywords.append("편안함")
                if "여가" in slogan_lower or "휴식" in slogan_lower:
                    fallback_keywords.append("여가")
                if "공간" in slogan_lower or "카페" in slogan_lower:
                    fallback_keywords.append("공간")
                if "커피" in slogan_lower:
                    fallback_keywords.append("커피")
                if fallback_keywords:
                    keywords = fallback_keywords
                    print(f"[DBG][extract_keywords_from_slogan:fallback] fallback_keywords={fallback_keywords}")
            
            # 중복 제거 및 정리
            cleaned = []
            seen = set()
            for kw in keywords:
                kw2 = (kw or "").strip()
                if kw2 and kw2.lower() not in seen:  # 대소문자 구분 없이 중복 체크
                    seen.add(kw2.lower())
                    cleaned.append(kw2)
            
            result = cleaned[:6]  # 최대 6개
            print(f"[DBG][extract_keywords_from_slogan:result] cleaned={result}")
            return result
        except Exception as e:
            # 에러 발생 시 로깅 후 빈 리스트 반환
            print(f"[DBG][extract_keywords_from_slogan:error] slogan={slogan[:50]}..., error={type(e).__name__}, message={str(e)}")
            import traceback
            print(f"[DBG][extract_keywords_from_slogan:traceback] {traceback.format_exc()}")
            return []

    # 트렌드 수정 추출
    async def extract_trend_edit(self, text: str) -> dict:
        structured = self.llm.with_structured_output(TrendEdit, method="function_calling")
        res: TrendEdit = await (TREND_EDIT_PROMPT | structured).ainvoke({"text": text or ""})
        data = res.model_dump(exclude_none=True)
        if isinstance(data.get("reco_keywords"), str):
            data["reco_keywords"] = [data["reco_keywords"]]
        if isinstance(data.get("reco_colors"), str):
            data["reco_colors"] = [data["reco_colors"]]
        return data

    # 웹 발췌 → 브리프
    async def _map_doc_to_brief(self, seed: dict, doc: Dict[str, str]) -> _DocBrief:
        structured = self.llm.with_structured_output(_DocBrief, method="function_calling")
        return await (MAP_DOC_TO_BRIEF_PROMPT | structured).ainvoke({"seed": seed, "doc": doc})

    # 브리프 통합 → 최종 추천
    async def _reduce_docs_to_recos(self, seed: dict, briefs: List[_DocBrief]) -> _BriefAgg:
        comp = []
        for b in briefs:
            comp.append({
                "colors": b.colors[:6],
                "fonts": b.fonts[:4],
                "copy_tone": b.copy_tone,
                "logo_style": b.logo_style,
                "notes": b.notes[:2],
            })
        structured = self.llm.with_structured_output(_BriefAgg, method="function_calling")
        return await (REDUCE_DOCS_TO_RECOS_PROMPT | structured).ainvoke({"seed": seed, "briefs": comp})

    # 검색결과 요약 → 추천 생성(토큰 예산/백오프 포함)
    async def summarize_recos_from_web(self, seed: dict, items: List[Dict[str, Any]]) -> dict:
        docs = _shrink_items(items, k=5, max_chars=600)
        budget = 3000
        total = sum(_approx_tokens(d["snippet"]) + _approx_tokens(d["title"]) for d in docs)
        while docs and total > budget:
            docs.pop()
            total = sum(_approx_tokens(d["snippet"]) + _approx_tokens(d["title"]) for d in docs)

        # 폴백
        if not docs:
            return {
                "reco_tone": seed.get("tone") or "따뜻하고 친근한",
                "reco_keywords": (seed.get("keywords") or [])[:4] or ["심플", "편안함", "자연", "미니멀"],
                "reco_colors": ["베이지", "브라운", "올리브", "딥그린"],
                "reco_slogan": "하루를 부드럽게 여는 한 잔",
                "notes": ["웹 축약 불가: 폴백 추천을 사용했습니다."]
            }

        async def _run_map():
            tasks = [self._map_doc_to_brief(seed, d) for d in docs]
            return await asyncio.gather(*tasks)
        briefs = await _retry_backoff(_run_map)

        async def _run_reduce():
            return await self._reduce_docs_to_recos(seed, briefs)
        agg = await _retry_backoff(_run_reduce)

        data = {
            "reco_tone": agg.reco_tone,
            "reco_keywords": agg.reco_keywords,
            "reco_colors": agg.reco_colors,
            "reco_slogan": agg.reco_slogan,
            "notes": agg.notes,
        }
        if isinstance(data.get("reco_keywords"), str):
            data["reco_keywords"] = [data["reco_keywords"]]
        if isinstance(data.get("reco_colors"), str):
            data["reco_colors"] = [data["reco_colors"]]
        return data