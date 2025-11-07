from __future__ import annotations
from typing import Any, Dict

def log_state(state: Dict[str, Any], where: str, **kv):
    """상태 안에 누적되는 디버그 로그. 콘솔에도 찍음."""
    entry = {"where": where, **kv}
    arr = state.get("_debug") or []
    arr.append(entry)
    state["_debug"] = arr
    # 콘솔 출력(원하면 주석)
    print(f"[DBG][{where}] {kv}")
