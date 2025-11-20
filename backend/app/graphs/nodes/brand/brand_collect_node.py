# 브랜드 정보 수집 노드 (1단계)
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-20: smalltalk 모드 추가

from __future__ import annotations

import json
from typing import Dict, Any, TYPE_CHECKING

from langchain_core.messages import SystemMessage, HumanMessage

from app.graphs.nodes.common.message_utils import get_last_user_message

if TYPE_CHECKING:
    from app.agents.state import AppState, BrandProfile
    from langchain_core.language_models.chat_models import BaseChatModel


def _merge_brand_profile(
    current: Dict[str, Any],
    updates: Dict[str, Any],
) -> Dict[str, Any]:
    """
    기존 brand_profile 위에 업데이트를 얹는 머지 함수.

    - updates에 없는 키는 그대로 둔다.
    - updates에 있는 키 중에서
      - None, 빈 문자열/공백 문자열은 무시
      - 그 외 값은 그대로 덮어씀
    """
    out = dict(current or {})

    for key, value in updates.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        out[key] = value

    return out


_BRAND_COLLECT_SYSTEM_PROMPT = """\
너는 한국 소상공인/1인 창업자를 돕는 브랜드 컨설턴트이자,
브랜드 정보를 JSON 형태로 정리해 주는 정리자야.

현재까지 알고 있는 브랜드 프로필과,
사용자의 최신 발화를 보고 어떤 필드가 새로 채워지거나 수정되었는지 추출해.

[브랜드 프로필 필드 정의]

- brand_name: 브랜드 이름
- category: 업종/카테고리 (예: 카페, 음식점, 패션, 뷰티, 온라인 교육 등)
- tone_mood: 브랜드 톤/무드 (예: 힙한, 고급스러운, 따뜻한, 캐주얼한 등)
- core_keywords: 브랜드를 설명하는 핵심 키워드들
  - 여러 개면 콤마(,)나 슬래시(/) 등으로 구분해서 하나의 문자열로 넣어도 된다.
- slogan: 슬로건 또는 한 줄 소개
- target_age: 타깃 연령대 (예: "20-30", "10대 후반 ~ 20대 초반" 등 자유 텍스트)
- target_gender: 타깃 성별 (예: "여성 위주", "남녀공용" 등)
- avoided_trends: 피하고 싶은 분위기/트렌드
- preferred_colors: 선호 색상/색감 (예: "파스텔 톤", "블랙+골드 조합" 등)

[출력 형식]

반드시 **JSON 한 개**만 출력해.

형식 예시는 아래와 같다.

{
  "brand_profile_updates": {
    "brand_name": "봉봉 커피",
    "category": "카페",
    "tone_mood": "아늑하고 편안한 분위기",
    "core_keywords": "동네 카페, 수제 디저트",
    "slogan": "동네에서 가장 편안한 한 잔",
    "target_age": "20-30",
    "target_gender": "남녀공용",
    "avoided_trends": "",
    "preferred_colors": "따뜻한 베이지 톤"
  }
}

규칙:
- 사용자가 이번 발화에서 **새로 말한 것 / 수정 의도가 있는 것**만 넣어.
- 애매하거나 추측인 값은 넣지 말고, 모르면 해당 키 자체를 빼.
- 빈 값("")이나 null을 넣지 말고, 아예 키를 생략해도 된다.
"""


def make_brand_collect_node(llm: "BaseChatModel"):
    """
    llm 인스턴스를 주입받아 brand_collect 노드를 만들어 주는 팩토리.

    brand_agent에서:

        llm = get_chat_model()
        brand_collect = make_brand_collect_node(llm)

    이런 식으로 사용.
    """
    def brand_collect(state: "AppState") -> "AppState":
        """
        마지막 사용자 발화에서 브랜드 정보를 추출해
        state.brand_profile 에 누적/병합하는 노드.
        """
        # 🔹 1) 의도가 smalltalk 이면 아무 것도 하지 않고 반환
        meta: Dict[str, Any] = dict(state.get("meta") or {})
        intent_label = None
        intent_info = meta.get("intent") or {}
        if isinstance(intent_info, dict):
            il = intent_info.get("label")
            if isinstance(il, str):
                intent_label = il

        if intent_label == "smalltalk":
            # 일상 대화일 때는 brand_profile 을 건드리지 않음
            return {}

        # 🔹 2) 그 외의 경우에만 기존 로직 수행
        user_text = get_last_user_message(state)
        if not user_text:
            # 유저 발화가 없으면 할 일이 없음
            return {}

        current_profile: Dict[str, Any] = dict(state.get("brand_profile") or {})
        current_profile_json = json.dumps(current_profile, ensure_ascii=False)

        system_prompt = _BRAND_COLLECT_SYSTEM_PROMPT + f"""

[현재까지 알고 있는 브랜드 프로필]

{current_profile_json}

이제 아래 사용자의 최신 발화를 보고,
새로 채워지거나 수정된 필드만 brand_profile_updates로 추출해.
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text),
        ]

        ai_msg = llm.invoke(messages)
        raw = (ai_msg.content or "").strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # JSON 파싱 실패 시, 프로필은 건드리지 않고 디버깅 정보만 남김
            new_meta = dict(state.get("meta") or {})
            new_meta.setdefault("brand_collect", {})
            new_meta["brand_collect"]["last_raw"] = raw
            return {
                "meta": new_meta,
            }

        updates = parsed.get("brand_profile_updates") or {}
        if not isinstance(updates, dict) or not updates:
            # 업데이트가 없으면 아무 변화 없음
            return {}

        merged_profile = _merge_brand_profile(current_profile, updates)

        new_meta = dict(state.get("meta") or {})
        new_meta.setdefault("brand_collect", {})
        new_meta["brand_collect"]["last_updates"] = updates

        return {
            "brand_profile": merged_profile,
            "meta": new_meta,
        }

    return brand_collect

