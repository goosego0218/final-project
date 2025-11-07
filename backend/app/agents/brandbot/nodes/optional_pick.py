# src/brandbot/nodes/optional_pick.py
from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM

async def optional_pick(state: SessionState) -> SessionState:
    text = (last_user_text(state) or "").strip()
    cands = state.get("optional_candidates") or {}
    draft = dict(state.get("brand_draft") or {})
    llm = LLM()

    # 사용자 입력을 바탕으로 field/value 매핑을 구조화
    prompt = {
        "user_text": text,
        "candidates": cands,
        "fields": list(cands.keys()) or ["target_age","target_gender","avoid_trends","slogan","colors"]
    }
    out = await llm.llm.ainvoke("아래 사용자 입력과 후보 리스트를 보고 어떤 필드가 어떤 값으로 선택/수정되었는지 "
                                "JSON으로만 반환하라. 형식: {updates: [{name, value}...]}\n" + str(prompt))
    updates = (out.dict().get("updates") if hasattr(out,"dict") else out).get("updates", [])

    for u in updates:
        f, v = u.get("name"), u.get("value")
        if f and v:
            draft[f] = v

    # '다른 걸로' 같은 요청이 있으면 다시 opt_reco로
    again = any(x in text for x in ("다른","또","새로","바꿔","변경","다시 추천"))
    nxt_intent = "opt_reco" if again else "collect"

    return {"brand_draft": draft, "_intent": nxt_intent}
