# src/brandbot/nodes/error_handler.py
from brandbot.state import SessionState

async def error_handler(state: SessionState) -> SessionState:
    msg = (
        "이 대화는 브랜드/마케팅을 중심으로 진행돼요.\n"
        "브랜드명, 업종/카테고리, 선호 톤이나 키워드를 편하게 말씀해 주시겠어요?"
    )
    # 회복용 메시지 지정 후 _error 리셋
    out = {"snapshot_text": msg, "_error": None}
    return out
