from __future__ import annotations
from brandbot.state import SessionState, last_user_text
from brandbot.utils.llm import LLM
from brandbot.utils.tracing import log_state

async def ensure_scope(state: SessionState) -> SessionState:
    text = last_user_text(state) or ""
    llm = LLM()
    tag = await llm.classify_scope(text)  # "in" | "out"

    # 디버그 로깅
    log_state(state, "ensure_scope", scope=tag, user=text)

    if tag == "out":
        return {
            "_intent": "scope_out",
            "snapshot_text": (
                "이 대화는 브랜드/마케팅을 중심으로 진행돼요.\n"
                "브랜드명, 업종/카테고리, 선호 톤이나 키워드를 편하게 말씀해 주시겠어요?"
            )
        }
    # in 스코프면 다음 게이트에서 의도 판정
    return {"_intent": "collect"}
