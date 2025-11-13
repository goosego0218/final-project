# src/brandbot/nodes/brand_collect.py
from __future__ import annotations
from typing import Dict, Any, List

from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM
from brandbot.utils.tracing import log_state
from .edit_utils import FIELD_LABELS, LIST_FIELDS, ensure_list

_REQUIRED = ["name", "industry"]  # 필수 항목
_OPTIONAL = ["tone", "keywords", "target_age", "target_gender", "avoid_trends", "slogan", "colors"]  # 옵션 항목 (수집 가능하지만 필수 아님)

def _has_value(v) -> bool:
    if v is None:
        return False
    if isinstance(v, str):
        return bool(v.strip())
    if isinstance(v, (list, tuple, set)):
        return len(v) > 0
    return True

def _is_edit_intent(text: str) -> bool:
    """수정 의도를 감지"""
    edit_keywords = (
        "변경", "수정", "바꿔", "바꾸", "교체", "다시", "재설정", "고치",
        "추가", "더해", "붙여", "넣어", "갱신", "새로"
    )
    text_lower = text.lower()
    return any(kw in text_lower for kw in edit_keywords)

def _merge_required_llm_policy(
    draft: dict,
    updates: Dict[str, Any],
    *,
    name_explicit: bool,
) -> dict:
    """
    LLM 정책 기반 병합:
      - name: 비었으면 채움, 이미 있으면 name_explicit=True 일 때만 교체
      - industry: 비었을 때만 채움(과잉 추론 방지)
      - tone, target_age, target_gender, slogan:
        * 비었을 때: 채움
        * 이미 있을 때: 기존값 유지(수정은 별도 편집 플로우에서 처리)
      - keywords, avoid_trends, colors: 리스트 병합(중복 제거)
    """
    out = dict(draft or {})

    # name
    if _has_value(updates.get("name")):
        if not _has_value(out.get("name")):
            out["name"] = updates["name"]
        elif name_explicit:
            out["name"] = updates["name"]

    # industry: 비었을 때만 채움(과잉 추론 방지)
    if _has_value(updates.get("industry")) and not _has_value(out.get("industry")):
        out["industry"] = updates["industry"]

    # tone, target_age, target_gender, slogan: 비었을 때 채움, 수정 의도면 교체
    for k in ("tone", "target_age", "target_gender", "slogan"):
        if _has_value(updates.get(k)):
            if not _has_value(out.get(k)):
                out[k] = updates[k]

    # keywords: 리스트 병합(중복 제거)
    if _has_value(updates.get("keywords")):
        cur = list(out.get("keywords") or [])
        vals = updates["keywords"]
        if isinstance(vals, str):
            vals = [vals]
        for kw in vals:
            if kw not in cur:
                cur.append(kw)
        out["keywords"] = cur

    # avoid_trends: 리스트 병합(중복 제거)
    if _has_value(updates.get("avoid_trends")):
        cur = list(out.get("avoid_trends") or [])
        vals = updates["avoid_trends"]
        if isinstance(vals, str):
            vals = [vals]
        for at in vals:
            if at not in cur:
                cur.append(at)
        out["avoid_trends"] = cur

    # colors: 리스트 병합(중복 제거)
    if _has_value(updates.get("colors")):
        cur = list(out.get("colors") or [])
        vals = updates["colors"]
        if isinstance(vals, str):
            vals = [vals]
        for c in vals:
            if c not in cur:
                cur.append(c)
        out["colors"] = cur

    return out


def _collect_pending_items(
    draft: Dict[str, Any],
    updates: Dict[str, Any],
    *,
    name_explicit: bool,
    targets: List[Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    ordered_fields = _REQUIRED + _OPTIONAL
    target_map = {
        t["field"]: t
        for t in (targets or [])
        if t.get("field") in (_REQUIRED + _OPTIONAL) and t.get("action") in {"replace", "append"}
    }

    iter_fields = ordered_fields if not target_map else [f for f in ordered_fields if f in target_map]

    for field in iter_fields:
        target = target_map.get(field)
        candidate = updates.get(field)
        if not _has_value(candidate):
            target_value = target.get("value") if target else None
            if field in LIST_FIELDS:
                candidate = ensure_list(target_value)
            else:
                candidate = target_value
            if _has_value(candidate):
                updates[field] = candidate
            else:
                continue

        if field == "name" and not name_explicit:
            continue

        current = draft.get(field)
        if not _has_value(current):
            continue

        if field in LIST_FIELDS:
            current_list = ensure_list(current)
            proposed_list = ensure_list(candidate)
            if not proposed_list:
                continue

            append_candidates = [v for v in proposed_list if v not in current_list]
            # 변화가 없으면 스킵
            if not append_candidates and set(current_list) == set(proposed_list):
                continue

            items.append(
                {
                    "field": field,
                    "type": "list",
                    "current": current_list,
                    "proposed": proposed_list,
                    "append_candidates": append_candidates,
                    "label": FIELD_LABELS.get(field, field),
                    "action": target.get("action") if target else "append",
                }
            )
        else:
            current_str = str(current).strip() if isinstance(current, str) else current
            proposed_str = str(candidate).strip() if isinstance(candidate, str) else candidate
            if proposed_str == current_str:
                continue

            items.append(
                {
                    "field": field,
                    "type": "scalar",
                    "current": current,
                    "proposed": candidate,
                    "label": FIELD_LABELS.get(field, field),
                    "action": target.get("action") if target else "replace",
                }
            )

    return items


async def brand_collect(state: SessionState) -> SessionState:
    """
    필수 2종(name/industry) 및 옵션 항목 수집.
    - 이름 교체 여부는 LLM의 명시성 판단(is_name_explicit)으로 제어
    - 옵션 항목들(tone, keywords, target_age, target_gender, avoid_trends, slogan, colors)은 발화에 포함되면 수집하지만 필수는 아님
    - 슬로건이 추출되면, 그 슬로건에서 핵심 키워드를 자동으로 추출하여 병합
    """
    text = last_user_text(state) or ""
    llm = LLM()

    # 1) 필수(name, industry) 및 옵션 항목 추출(정규화/요약 포함)
    extracted = await llm.extract_required_only(text)
    log_state(state, "brand_collect:extracted", extracted=extracted)

    # 2) 이름 명시 여부 LLM 판별
    name_explicit = await llm.is_name_explicit(text)

    # 3) 슬로건이 추출되었으면, 슬로건에서 핵심 키워드 추출
    slogan = extracted.get("slogan") if extracted else None
    if _has_value(slogan):
        log_state(state, "brand_collect:slogan_detected", slogan=slogan)
        try:
            keywords_from_slogan = await llm.extract_keywords_from_slogan(slogan)
            log_state(state, "brand_collect:slogan_keywords_extracted", keywords=keywords_from_slogan)
            
            if keywords_from_slogan:
                # 추출된 키워드를 extracted에 추가 (병합은 나중에 _merge_required_llm_policy에서 처리)
                if "keywords" not in extracted:
                    extracted["keywords"] = []
                if isinstance(extracted["keywords"], str):
                    extracted["keywords"] = [extracted["keywords"]]
                existing_keywords = list(extracted.get("keywords") or [])
                # 중복 제거하며 병합
                seen = set(existing_keywords)
                for kw in keywords_from_slogan:
                    if kw not in seen:
                        existing_keywords.append(kw)
                        seen.add(kw)
                extracted["keywords"] = existing_keywords
                log_state(state, "brand_collect:slogan_keywords_merged", 
                         before=existing_keywords[:len(existing_keywords)-len(keywords_from_slogan)], 
                         after=existing_keywords)
            else:
                log_state(state, "brand_collect:slogan_keywords_empty", slogan=slogan)
        except Exception as e:
            log_state(state, "brand_collect:slogan_keywords_error", 
                     error=type(e).__name__, 
                     message=str(e))

    # 4) 수정 의도 감지 및 대기 항목 구성
    is_edit = _is_edit_intent(text)
    draft0 = state.get("brand_draft") or {}
    detected_targets: List[Dict[str, Any]] = []
    if is_edit:
        detected_targets = await llm.detect_edit_targets(text, draft0)

    updates_base = dict(extracted or {})
    updates_for_pending = dict(updates_base)
    updates_for_merge = dict(updates_base)
    pending_payload: Dict[str, Any] = {}

    if is_edit:
        pending_items = _collect_pending_items(
            draft0,
            updates_for_pending,
            name_explicit=name_explicit,
            targets=detected_targets,
        )
        if pending_items:
            for item in pending_items:
                updates_for_pending.pop(item["field"], None)
            pending_payload = {
                "pending_edit": {
                    "items": pending_items,
                    "index": 0,
                    "status": "pending_confirm",
                    "detected": detected_targets,
                },
                "_intent": "edit_confirm",
                "edit_choice_retry": False,
            }
            log_state(state, "brand_collect:pending_edit", pending_items=pending_items)
            updates_for_merge = updates_for_pending
        else:
            # 수정 의도지만 대기 항목이 없으면 기존 pending 제거
            pending_payload = {
                "pending_edit": {},
                "edit_choice_retry": False,
            }
            updates_for_merge = updates_for_pending
    else:
        pending_payload = {
            "pending_edit": {},
            "edit_choice_retry": False,
        }
        updates_for_merge = updates_for_pending

    # 5) 병합
    draft1 = _merge_required_llm_policy(draft0, updates_for_merge or {}, name_explicit=name_explicit)
    log_state(state, "brand_collect:merged", before=draft0, after=draft1, is_edit=is_edit, pending=pending_payload)

    response = {"brand_draft": draft1}
    response.update(pending_payload)
    return response