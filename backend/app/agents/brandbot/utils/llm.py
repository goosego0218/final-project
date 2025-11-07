# src/brandbot/utils/llm.py
from __future__ import annotations
from typing import List, Dict, Any, Optional
import asyncio
import random

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from brandbot.config import SETTINGS
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

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "입력이 브랜딩/마케팅/디자인/트렌드/로고/카피/네이밍 관련이면 'in', 아니면 'out'만 출력하라. "
             "짧거나 애매한 확인/대기 표현(예: '응', '기다려', '카페임', '브랜드명 사용자 커피')은 'in'으로 간주."),
            ("user", "{text}"),
            ("system", "예시: '브랜드명 사용자 커피' -> in"),
            ("system", "예시: '오늘 날씨 어때' -> out"),
        ])
        out = await (prompt | self.llm).ainvoke({"text": t})
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

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "의도 분류: 'trend' | 'confirm' | 'collect' | 'review' | 'trend_edit' | 'apply_recos' 중 하나만 출력.\n"
             "- 'trend': 트렌드 정보를 요청하는 경우 (예: '트렌드 알려줘', '최신 트렌드 보여줘')\n"
             "- 'collect': 브랜드 정보를 제공하는 경우 (예: 타깃, 색상, 슬로건, 분위기, 키워드 등 브랜드 속성 제공)\n"
             "- 'confirm': 프로젝트를 확정하는 경우 (예: '이대로 확정', '프로젝트 생성')\n"
             "- 'review': 현재까지 수집된 정보를 요약/정리하는 경우\n"
             "- 'apply_recos': 추천을 적용하는 경우\n"
             "- 'trend_edit': 트렌드 추천을 수정하는 경우\n"
             "중요: 타깃, 색상, 슬로건, 기피 트렌드 등을 제공하는 것은 'collect' 의도입니다."),
            ("user", "{text}")
        ])
        out = await (prompt | self.llm).ainvoke({"text": t})
        ans = (out.content or "").strip().lower()
        for tag in ["trend_edit","apply_recos","trend","confirm","review","collect"]:
            if ans.startswith(tag):
                return tag  # type: ignore[return-value]
        return "collect"  # type: ignore[return-value]

    # 이름 명시 여부 판별: 정규식 대신 LLM 분류
    async def is_name_explicit(self, text: str) -> bool:
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "아래 한국어 문장에서 사용자가 '브랜드명/상호/이름'을 **명시적으로** 지정했는지 판정하라. "
             "예: '브랜드명은 ○○', '상호는 ○○', '이름은 ○○' 등은 True. "
             "그 외 암시적 언급(예: '○○ 커피')은 False. 오직 True/False만 출력."),
            ("user", "{text}")
        ])
        out = await (prompt | self.llm).ainvoke({"text": text or ""})
        ans = (out.content or "").strip().lower()
        return ans.startswith("t")  # true/True

    # 필수 2종(name, industry) 및 옵션 항목 추출(정규화·요약 포함)
    async def extract_required_only(self, text: str) -> Dict[str, Any]:
        sys_rules = (
            "너는 한국어 브랜드 기획 보조 추출기다. 다음 사용자 발화에서 브랜드 정보를 정규화하여 JSON으로 추출하라.\n"
            "필수 키: name, industry (발화에 명시적으로 언급된 경우만 추출, 예: '브랜드명은 ○○', '○○ 커피', '카페임')\n"
            "옵션 키: tone, keywords, target_age, target_gender, avoid_trends, slogan, colors (발화에 포함되면 추출, 없으면 생략)\n"
            "주의: name은 브랜드명/상호가 명시적으로 언급된 경우만 추출. 분위기/톤 설명은 name이 아닌 tone으로 추출.\n"
            "정규화 규칙:\n"
            "1) 말끝/종결어미 제거: '임/입니다/이에요/예요/에요/이요/같아요/같음' 등은 값 말미에서 제거.\n"
            "2) 조사 제거: 값 말미의 '은/는/이/가/을/를/의/으로/로/에서/부터/까지' 삭제.\n"
            "3) 업종 동의어 스냅: '커피숍','커피샵','카페점'은 '카페'로 표준화. 그 외 업종은 원형 보존.\n"
            "4) tone(분위기): 브랜드의 전체적인 분위기/톤앤매너/스타일을 추출. 다음 표현이 나오면 반드시 tone으로 추출:\n"
            "   - '~풍', '~분위기', '~느낌', '~스타일', '~톤' 등의 표현 (예: '일본풍', '모던한 분위기', '따뜻한 느낌', '미니멀 스타일')\n"
            "   - '분위기는 ~', '~분위기를 가지고있음', '~느낌임', '~스타일' 등의 명시적 표현\n"
            "   - 문장부호/말끝 제거만 하고 의미는 보존 (예: '일본풍의 분위기를 가지고있음' → tone='일본풍 분위기' 또는 '일본풍')\n"
            "5) keywords는 문장에서 '브랜드 컨셉/감성/USP/테마'에 해당하는 핵심 개념만 2~6개 선별해 반환. "
            "   단어 단위 난분해 금지, 불용어/조사/접속어/수식어구 제거. 유사 표현은 하나로 축약.\n"
            "   tone으로 추출 가능한 표현(예: '~풍 분위기', '~느낌')은 keywords에서 제외.\n"
            "6) 인구통계(연령/성별/직업 등)는 keywords에 넣지 말고, target_age/target_gender에 저장. (예: '20대 남성' → target_age='20대', target_gender='남성')\n"
            "7) avoid_trends: 기피하고 싶은 트렌드/스타일을 리스트로 추출. **단, 사용자가 명시적으로 '기피', '피하고 싶다', '싫어', '안 좋아' 등으로 언급한 경우만** 추출. 발화에 기피 의사가 없으면 추출하지 말 것.\n"
            "8) slogan: 슬로건/태그라인을 추출하라. 다음 경우에 슬로건으로 인식:\n"
            "   - 명시적 표현: '슬로건은...', '태그라인은...' 등\n"
            "   - 브랜드 비전/컨셉/목표를 설명하는 문장 (예: '우리 카페는 ~될 것', '~하는 카페입니다', '~를 위한 카페가 되기위해...')\n"
            "   - 브랜드의 핵심 가치나 차별점을 설명하는 문장\n"
            "   - 키워드로 분해 가능한 문장은 keywords에 넣고, 전체 문장이 브랜드 컨셉을 설명한다면 slogan에도 포함\n"
            "   - '~를 위한', '~되기위해', '~목표로', '~이 되기위해' 같은 목표 설명 문장도 슬로건으로 인식\n"
            "9) colors: 선호 색상이 명시되면 리스트로 추출 (예: ['파스텔 블루', '베이지'])\n"
            "10) 추론/창작 금지: 발화에 직접 언급되지 않은 값은 만들지 말 것.\n"
            "11) 값 끝의 문장부호 삭제.\n"
            "12) '... 카페임'처럼 업종만 언급하고 브랜드명을 명시하지 않은 문장은 name을 비워 두고 industry만 추출. 설명형 문장은 tone이나 keywords로 분리하고 name으로 오인하지 말 것.\n"
        )

        fewshots = [
            ("user", "호호 커피, 카페임"),
            ("assistant", '{{"name":"호호 커피","industry":"카페"}}'),
            ("user", "브랜드명은 맨즈 커피고 업종은 카페입니다"),
            ("assistant", '{{"name":"맨즈 커피","industry":"카페"}}'),
            ("user", "분위기는 따뜻한 느낌이에요, 키워드는 포근함, 내추럴 · 미니멀; 심플"),
            ("assistant", '{{"tone":"따뜻한 느낌","keywords":["포근함","내추럴","미니멀","심플"]}}'),
            ("user", "일본풍의 분위기를 가지고있음"),
            ("assistant", '{{"tone":"일본풍 분위기"}}'),
            ("user", "일본풍의 분위기를 가지고 있는 카페임"),
            ("assistant", '{{"industry":"카페","tone":"일본풍 분위기"}}'),
            ("user", "카페 창업 준비중이고 김줭남 카페임, 우리 카페는 일본풍 분위기의 카페이고 고객들이 일본을 방문하지않아도 일본 분위기를 제공해주는것이 목적임"),
            ("assistant", '{{"name":"김줭남 카페","industry":"카페","tone":"일본풍 분위기","slogan":"우리 카페는 일본풍 분위기의 카페이고 고객들이 일본을 방문하지않아도 일본 분위기를 제공해주는것이 목적임","keywords":["일본 분위기 제공","문화 경험"]}}'),
            ("user", "활발한 분위기를 가지고있음"),
            ("assistant", '{{"tone":"활발한 분위기"}}'),
            ("user", "전체적으로 어둡고 20대 초반 남/녀들이 좋아하는 분위기"),
            ("assistant", '{{"tone":"어두운 분위기","target_age":"20대 초반"}}'),
            ("user", "키워드는 활동적이고 스포티한 감성, 심플 컬러, 산뜻함"),
            ("assistant", '{{"keywords":["활동적","스포티","심플 컬러","산뜻함"]}}'),
            ("user", "20대 중후반 남성 타겟이고, 파스텔 블루 색상 선호해요"),
            ("assistant", '{{"target_age":"20대 중후반","target_gender":"남성","colors":["파스텔 블루"]}}'),
            ("user", "슬로건은 '하루를 부드럽게 여는 한 잔'이고, 화려한 색상은 기피하고 싶어요"),
            ("assistant", '{{"slogan":"하루를 부드럽게 여는 한 잔","avoid_trends":["화려한 색상"]}}'),
            ("user", "우리 카페는 전체적으로 일본풍이고 일본에 가지않아도 일본 분위기를 주는것이 목표임"),
            ("assistant", '{{"slogan":"우리 카페는 전체적으로 일본풍이고 일본에 가지않아도 일본 분위기를 주는것이 목표임","keywords":["일본풍","일본 분위기"]}}'),
            ("user", "우리 카페는 남성들의 재방문을 위해 빠른 커피 서빙과 아름다운 알바생이 있는 카페가 될 것"),
            ("assistant", '{{"slogan":"우리 카페는 남성들의 재방문을 위해 빠른 커피 서빙과 아름다운 알바생이 있는 카페가 될 것","keywords":["빠른 커피 서빙","아름다운 알바생"],"target_gender":"남성"}}'),
            ("user", "우리 카페는 20대 초반 남녀를 위한 카페가 되기위해 김치 커피를 신매뉴로 내놓았습니다"),
            ("assistant", '{{"slogan":"우리 카페는 20대 초반 남녀를 위한 카페가 되기위해 김치 커피를 신매뉴로 내놓았습니다","keywords":["김치 커피","신메뉴"],"target_age":"20대 초반","target_gender":"남녀"}}'),
            ("user", "젊은 세대가 모이는 트렌디한 공간이 목표예요"),
            ("assistant", '{{"slogan":"젊은 세대가 모이는 트렌디한 공간이 목표예요","keywords":["트렌디한 공간","젊은 세대"]}}'),
        ]

        prompt = ChatPromptTemplate.from_messages(
            [("system", sys_rules)] + fewshots + [("user", "{text}")]
        )
        structured = self.llm.with_structured_output(RequiredExtract, method="function_calling")
        res: RequiredExtract = await (prompt | structured).ainvoke({"text": text or ""})
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

        sys_rules = (
            "너는 슬로건 분석 전문가다. 다음 슬로건에서 브랜드의 핵심 가치/감성/컨셉을 나타내는 키워드를 2~6개 반드시 추출하라.\n"
            "\n"
            "추출 규칙:\n"
            "1) 슬로건의 핵심 의미를 담은 명사/형용사/명사형 키워드만 추출\n"
            "2) 인구통계(연령/성별/직업 등)는 제외하되, 감성/컨셉 키워드는 추출\n"
            "   예: '20대 여성'은 제외, '편안함', '여가'는 추출\n"
            "3) 구체적이고 명확한 키워드만 (예: '편안함', '여가', '공간', '휴식', '커피')\n"
            "4) 반드시 2개 이상 추출해야 함 (빈 리스트 불가)\n"
            "\n"
            "예시:\n"
            "- '편안하게 커피를 마실 수 있는' → ['편안함', '커피', '여유']\n"
            "- '여가생활을 즐길 수 있는 공간' → ['여가', '공간', '휴식']\n"
            "- '20대 초반 여성이 편안하게' → ['편안함', '청춘'] (20대 초반, 여성은 제외)\n"
        )

        fewshots = [
            ("user", "하루를 부드럽게 여는 한 잔"),
            ("assistant", '{{"keywords": ["부드러움", "편안함", "일상"]}}'),
            ("user", "젊은 에너지로 가득한 공간"),
            ("assistant", '{{"keywords": ["에너지", "활기", "청춘"]}}'),
            ("user", "따뜻하고 친근한 커뮤니티 카페"),
            ("assistant", '{{"keywords": ["따뜻함", "친근함", "커뮤니티"]}}'),
            ("user", "우리 카페는 20대 초반 여성들이 편안하게 여가생활을 즐길 수 있는 공간이다"),
            ("assistant", '{{"keywords": ["편안함", "여가", "공간", "휴식"]}}'),
            ("user", "우리 카페는 20대 초반 여성이 편안하게 커피를 마실 수 있는 카페이다"),
            ("assistant", '{{"keywords": ["편안함", "커피", "여유", "공간"]}}'),
        ]

        prompt = ChatPromptTemplate.from_messages(
            [("system", sys_rules)] + fewshots + [("user", "{slogan}")]
        )
        structured = self.llm.with_structured_output(_KeywordsFromSlogan, method="function_calling")
        
        try:
            res: _KeywordsFromSlogan = await (prompt | structured).ainvoke({"slogan": slogan.strip()})
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
        sys = (
            "사용자 입력에서 트렌드 추천 항목 수정값을 추출하라. "
            "허용 키: reco_tone, reco_keywords[], reco_colors[], reco_slogan. "
            "존재하는 항목만 JSON으로 반환."
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", sys),
            ("user", "{text}")
        ])
        structured = self.llm.with_structured_output(TrendEdit, method="function_calling")
        res: TrendEdit = await (prompt | structured).ainvoke({"text": text or ""})
        data = res.model_dump(exclude_none=True)
        if isinstance(data.get("reco_keywords"), str):
            data["reco_keywords"] = [data["reco_keywords"]]
        if isinstance(data.get("reco_colors"), str):
            data["reco_colors"] = [data["reco_colors"]]
        return data

    # 웹 발췌 → 브리프
    async def _map_doc_to_brief(self, seed: dict, doc: Dict[str, str]) -> _DocBrief:
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "아래 웹 발췌를 참고해 업종/톤/키워드를 고려한 트렌드 힌트를 간단 JSON으로: "
             "colors[], fonts[], copy_tone, logo_style, notes[]. 과장 금지."),
            ("user", "seed={seed}\ndoc={doc}")
        ])
        structured = self.llm.with_structured_output(_DocBrief, method="function_calling")
        return await (prompt | structured).ainvoke({"seed": seed, "doc": doc})

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
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "문서별 브리프를 통합해 최종 추천을 생성하라. "
             "출력은 JSON: reco_tone, reco_keywords[], reco_colors[], reco_slogan, notes[]. "
             "키워드는 3~6개, 색상은 3~6개, 과장 금지."),
            ("user", "seed={seed}\nbriefs={briefs}")
        ])
        structured = self.llm.with_structured_output(_BriefAgg, method="function_calling")
        return await (prompt | structured).ainvoke({"seed": seed, "briefs": comp})

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