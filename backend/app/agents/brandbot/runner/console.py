# src/brandbot/runner/console.py
import asyncio
from typing import Optional
from brandbot.state import initial_state
from brandbot.config import SETTINGS
from langchain_core.messages import HumanMessage

class ConsoleRunner:
    def __init__(self, graph, thread_id: str | None = None):
        """
        graph: build_graph()의 반환값(CompiledGraph)
        thread_id: 환경변수 THREAD_ID 또는 기본값 사용
        """
        self.graph = graph
        self.thread_id = thread_id or SETTINGS.thread_id
        self.state = initial_state()

    async def step(self, user_text: str) -> dict:
        # add_messages 리듀서용 증분 입력
        inc = {"messages": [HumanMessage(content=user_text)]}
        self.state.update(inc)

        # 비동기 실행
        self.state = await self.graph.ainvoke(
            self.state,
            config={"configurable": {"thread_id": self.thread_id}, "recursion_limit": 8,},
        )
        return self.state

    def last_snapshot(self) -> Optional[str]:
        return self.state.get("snapshot_text")

    def is_confirmed(self) -> bool:
        return bool(self.state.get("confirmed"))

    def project_id(self) -> Optional[str]:
        return self.state.get("project_id")
