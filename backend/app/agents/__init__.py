"""에이전트 패키지 초기화.

이 모듈은 `app/agents` 하위에 벤더링된 외부 에이전트 패키지를
최상위 모듈 이름으로 가져올 수 있도록 `sys.path`에 현재 디렉터리를
추가한다. 이를 통해 `brandbot` 패키지가 기존 경로(`app/agents/brandbot`)
에 위치해도 `import brandbot` 형태로 사용할 수 있다.
"""

from __future__ import annotations

import sys
from pathlib import Path

_AGENTS_DIR = Path(__file__).resolve().parent

if str(_AGENTS_DIR) not in sys.path:
    # FastAPI/uvicorn 실행 시 최상위 경로에 대해 상대 임포트가 가능하도록 추가
    sys.path.insert(0, str(_AGENTS_DIR))

__all__ = ["brandbot"]

