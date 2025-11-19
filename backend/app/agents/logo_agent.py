# 로고 LangGraph
# 작성자: 황민준
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성

from __future__ import annotations
from typing import Literal

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage, AnyMessage
from langgraph.graph.message import add_messages

from app.agents.state import AppState
from app.llm.client import get_chat_model

llm = get_chat_model()