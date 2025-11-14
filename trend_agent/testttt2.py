import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.tools import tool
from langchain.agents import create_agent
from langchain_tavily import TavilySearch
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents.middleware import SummarizationMiddleware, AgentMiddleware, hook_config
from typing import Any, List

from langchain_core.documents import Document
from langchain_community.document_compressors.jina_rerank import JinaRerank
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_core.retrievers import BaseRetriever


load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
JINA_API_KEY = os.getenv("JINA_API_KEY")

# ===== 1) LLM =====
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
)

# ===== 2) 내부 벡터DB  =====
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectordb = Chroma(
    persist_directory="./chroma_db_test",
    embedding_function=embeddings,
)
retriever = vectordb.as_retriever(search_kwargs={"k": 10})


tavily_search = TavilySearch(
    max_results=5,
    search_depth="advanced",  
)

MAX_LOG_CHARS = 400  # 이미 있으면 이 줄은 생략


def apply_rerank(
    query: str,
    documents: List[Document],
    top_n: int = 5,
) -> List[Document]:
    """
    Jina Reranker로 문서 리스트를 재정렬하고 상위 top_n개만 남긴다.
    - JINA_API_KEY 없으면 그냥 앞에서 top_n개만 잘라서 쓴다.
    """
    if not documents:
        return []

    if not JINA_API_KEY:
        print(f"  → JINA_API_KEY 없음, Rerank 생략 (상위 {top_n}개 사용)")
        return documents[:top_n]

    try:
        compressor = JinaRerank(
            jina_api_key=JINA_API_KEY,
            model="jina-reranker-v3",
            top_n=top_n,
        )

        class DummyRetriever(BaseRetriever):
            """Rerank 전용 더미 Retriever"""

            def _get_relevant_documents(self, q: str) -> List[Document]:
                return documents

            async def _aget_relevant_documents(self, q: str) -> List[Document]:
                return documents

        dummy_retriever = DummyRetriever()
        compression_retriever = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=dummy_retriever,
        )

        reranked_docs = compression_retriever.invoke(query)
        print(f"  → Rerank 완료: {len(documents)}개 → {len(reranked_docs)}개")
        return reranked_docs

    except Exception as e:
        print(f"  → Rerank 오류: {e}, 상위 {top_n}개만 사용")
        return documents[:top_n]

MAX_LOG_CHARS = 400 

def _shorten(text: Any, max_len: int = MAX_LOG_CHARS) -> str:
    s = str(text)
    if len(s) <= max_len:
        return s
    return s[:max_len] + f"... (총 {len(s)}자 중 앞 {max_len}자만 표시)"


class LoggingMiddleware(AgentMiddleware):
    """LLM 입출력을 터미널에 깔끔하게 찍어주는 디버깅용 미들웨어"""

    @hook_config()
    def before_model(self, state, runtime):
        messages: List[BaseMessage] = state.get("messages", [])
        if not messages:
            return None

        last = messages[-1]
        print("\n[LOG] ===== LLM 입력 =====")
        print(self._format_message(last, direction="in"))
        return None

    @hook_config()
    def after_model(self, state, runtime):
        messages: List[BaseMessage] = state.get("messages", [])
        if not messages:
            return None

        last = messages[-1]
        print("\n[LOG] ===== LLM 출력 =====")
        print(self._format_message(last, direction="out"))
        return None

    def _format_message(self, msg: BaseMessage, direction: str) -> str:
        # 1) 사용자 입력
        if isinstance(msg, HumanMessage):
            return f"[Human] {_shorten(msg.content)}"

        # 2) LLM 출력 (툴 호출 포함)
        if isinstance(msg, AIMessage):
            tool_calls = getattr(msg, "tool_calls", None) or msg.additional_kwargs.get("tool_calls")
            if tool_calls:
                lines = ["[AI -> Tool 호출]"]
                for tc in tool_calls:
                    name = tc.get("name")
                    args = tc.get("args")
                    lines.append(f"- tool: {name}, args: {_shorten(args, 150)}")
                return "\n".join(lines)
            return f"[AI] {_shorten(msg.content)}"

        # 3) Tool 결과
        if msg.type == "tool":
            name = getattr(msg, "name", None) or msg.additional_kwargs.get("name", "")
            header = f"[Tool 결과: {name}]" if name else "[Tool 결과]"
            return f"{header} {_shorten(getattr(msg, 'content', '') or '')}"

        # 4) System / 기타
        return f"[{msg.type}] {_shorten(getattr(msg, 'content', '') or '')}"  

@tool
def internal_search_tool(query: str) -> str:
    """
    내부 마크다운/트렌드 DB에서 query와 관련된 내용을 검색해 요약 없이 원문 위주로 돌려준다.

    - 항상 웹 검색(Tavily)을 쓰기 전에 먼저 이 도구를 사용해야 한다.
    - 결과가 거의 없거나, 너무 짧으면 '정보가 부족하다'고 판단하고 웹 검색 도구를 추가로 사용하라.
    """
    docs: List[Document] = retriever.invoke(query)
    print(f"[DEBUG] internal_search_tool - raw docs from vectordb: {len(docs)}")
    
    if not docs:
        return "[NO_INTERNAL_RESULTS] 검색 결과 없음."

    # Jina 리랭커 적용
    docs = apply_rerank(query, docs, top_n=5)
    print(f"[DEBUG] internal_search_tool - docs after rerank: {len(docs)}")

    chunks = []
    for i, d in enumerate(docs, start=1):
        meta = d.metadata or {}
        source = meta.get("source", "unknown")
        title = meta.get("title", "")
        header = f"[{i}] source: {source}"
        if title:
            header += f" | title: {title}"
        chunks.append(header + "\n" + d.page_content.strip())

    return "\n\n---\n\n".join(chunks)

@tool("tavily_search")# SYSTEM_PROMPT에 맞춘 거
def external_search_tool(query: str) -> str:
    """
    Tavily 웹 검색 툴.

    동작 요약:
    1) 에이전트 LLM이 넘겨준 query(툴용 쿼리)를 받아서
       LLM에게 '웹 검색용 키워드 한 줄'로 정제시키고,
    2) 그 키워드를 Tavily에 그대로 넘겨서 검색한다.
    3) Tavily 결과를 사람이 보기 좋은 텍스트 블록으로 합쳐서 반환한다.
    """
    print("\n[DEBUG] ===== Tavily 툴 시작 =====")
    print(f"[DEBUG] user_question: {query}")

    prompt = f"""
    다음 '질문 문장'을 웹 검색용 키워드 한 줄로 바꿔줘.

    규칙:
    - 존댓말/조사/끝말(요, 입니다, 해줘 등)은 빼고 핵심 키워드만 남겨라.
    - 출력은 한 줄짜리 검색어 문자열만 내고, 설명은 쓰지 마라.
    질문 문장: {query}
    """

    resp = llm.invoke(prompt)
    search_query = resp.content.strip()
    print(f"[DEBUG] tavily_search_query (LLM): {search_query}")

    raw = tavily_search.invoke({
        "query": search_query,
        "days" : 366,
        })

    # 2) 응답 통일 (dict or list)
    if isinstance(raw, dict) and "results" in raw:
        results = raw["results"]
    elif isinstance(raw, list):
        results = raw
    else:
        print(f"[DEBUG] 예기치 못한 Tavily 응답 타입: {type(raw)}")
        return "Tavily 검색 결과 형식이 예상과 다릅니다."
    
    # 3) results → Document 리스트로 변환
    docs: List[Document] = []
    for r in results:
        if not isinstance(r, dict):
            continue

        content = (r.get("content") or r.get("snippet") or "").strip()
        if not content:
            continue

        docs.append(
            Document(
                page_content=content,
                metadata={
                    "source": "tavily",
                    "url": (r.get("url") or "").strip(),
                    "title": (r.get("title") or "").strip(),
                },
            )
        )

    if not docs:
        return "[NO_TAVILY_RESULTS] Tavily 검색 결과가 없습니다."

    # 4) Jina 리랭커 적용
    docs = apply_rerank(query, docs, top_n=5)

    blocks: List[str] = []
    for i, d in enumerate(docs, start=1):
        meta = d.metadata or {}
        title = (meta.get("title") or "").strip()
        url = (meta.get("url") or "").strip()
        content_trimmed = d.page_content[:500]

        block = f"[웹 검색 {i}] {title}\n{url}\n{content_trimmed}"
        blocks.append(block)

    final = "\n\n---\n\n".join(blocks)

    print("\n[DEBUG] ===== Tavily 정제 결과 (앞부분) =====")
    print(final[:1000])

    return final


SYSTEM_PROMPT = """
너는 트렌드/마케팅 리서치 어시스턴트다.
사용자의 질문에 대해, 내부 DB와 웹 검색 결과를 바탕으로
신뢰도 높은 정보를 한국어로 정리해서 답변한다.

# 전체 전략
1. 가능한 한 **내부 DB(internal_search_tool)** 내용을 우선 사용한다.
2. 내부 DB만으로는 정보가 **부족하거나, 너무 일반적이거나, 오래되었다고 판단되는 경우**에만
   **웹 검색(tavily_search)** 를 추가로 사용한다.
3. 내부 정보와 웹 검색 정보를 **섞어서 쓸 때는 출처를 명확히 구분**한다.
4. 모르는 내용은 지어내지 말고, **"내부 자료와 웹 검색 어디에서도 확인되지 않는다"**고 솔직하게 말한다.

# 도구 사용 규칙

## 1. internal_search_tool (반드시 먼저 시도)
- 사용 목적:
  - 내부 마크다운/트렌드 DB에서 관련 내용을 찾기 위함.
- 사용 시점:
  - 사용자의 질문을 받은 뒤, **항상 가장 먼저 한 번은 호출한다.**
- 출력 해석:
  - 여러 개의 청크가 구분선(---)으로 나뉘어서 텍스트로 들어온다.
  - 각 청크에는 `source, filename, url` 같은 메타데이터가 포함될 수 있다.
  - 이 텍스트를 **내부 자료의 요약/근거**로 사용하되,
    그대로 복붙하기보다는 핵심만 정리해서 답변에 녹여라.

내부 검색 결과가 다음과 같을 때는 “정보가 부족하다”고 판단하라:
- 관련 없어 보이는 내용만 나오거나
- 매우 짧은 설명만 있고, 질문의 핵심(연도/업종/사례 등)을 다루지 않거나
- 질문이 "최신 동향"을 묻고 있는데, 내부 자료가 특정 시점에 한정되어 있을 때

이런 경우에는 내부 자료에서 쓸 수 있는 부분만 먼저 정리하고,
그 다음 Tavily를 사용해 최신 정보/보완 정보를 가져와라.

## 2. tavily_search (보조 수단)
- 사용 목적:
  - **내부 자료로 부족한 부분을 보완**하거나,
  - **최신 트렌드, 구체적 사례, 통계** 등 외부 정보가 필요한 경우.
- 사용 시점:
  - internal_search_tool 결과만으로는 사용자의 질문에 충분히 답변하기 어렵다고 판단될 때.
- 쿼리 작성:
  - **사용자가 질문에서 직접 언급한 연도(예: 2023, 2025)만 사용할 수 있다.**
  - **질문에 연도가 없다면, 2020~2030 같은 연도를 새로 만들지 마라.**
  - 최신성을 표현하고 싶으면 `"latest"`, `"recent"`, `"current trend"` 같은 표현만 사용하라.
- 결과 활용:
  - 검색 결과에서 **핵심 주장, 트렌드 방향, 구체적 사례(브랜드/캠페인 등)**만 추려서 사용한다.
  - 특정 사이트의 홍보성 문구는 그대로 반복하지 말고, 요약하여 중립적으로 서술한다.

# 답변 작성 규칙

1. **항상 한국어로 답변**한다.
2. 구조를 명확히 하라. 예를 들면:
   - "요약" / "주요 트렌드" / "사례" / "실무에 어떻게 활용할 수 있는지" 등으로 나누어 정리.
3. 내부 자료 vs 웹 검색 결과를 구분해서 표현하라.
   - 예) 
     - "내부 자료 기준으로 보면, ..."
     - "최근 웹 검색 결과를 보면, ..."
4. 지어내지 말 것.
   - 내부/웹 어디에도 없는 정보는 **추측하지 말고**:
     - "이 부분은 내부 자료와 웹 검색 어디에서도 명확한 근거를 찾지 못했다."라고 말한다.
5. 너무 단정적으로 말하지 말고, 불확실한 부분은 **"가능성이 있다 / 추정된다"**처럼 완화해라.
6. 숫자/통계/연도는 가능하면 **출처 유형(리포트, 기사, 블로그 등)**를 함께 언급한다.
7. 도구 결과에 `SOURCE_URL: ...`, `URL: ...` 줄이 있으면,  
   - 답변 하단에 **"참고 링크" 섹션**을 만들어 모아서 보여줘라.
   - 각 항목은 `- 설명 (출처: 내부 자료 / 웹 검색 N) : URL` 형식으로 적어라.
8. 도구 결과에 `IMAGE_URLS:` 아래 이미지 주소 목록이 있으면,  
   - 답변 하단에 **"참고 이미지" 섹션**을 만들어 URL들을 bullet로 나열하라.
   - 필요하면 텍스트에서 "자세한 예시는 아래 참고 이미지 링크를 참고하라" 정도로만 언급해라.

# 대화 맥락 파악
**항상 이전 대화 내용을 고려해서 답변하라.**

사용자가 "그거", "이거", "그럼", "어떻게 해", "추천해줘" 같은 짧은 질문을 하면:
- 바로 직전 질문/답변의 주제와 연결해서 해석하고 답변한다
- 예: "색상 추천해줘" → 이전에 로고 얘기했으면 "로고 색상 추천"

# 자기검열(최종 체크)

최종 답변을 내기 전에, 스스로 다음을 점검하라:

1. **질문 적합성**  
   - 내가 쓴 답변이 사용자의 질문에 직접적으로 답하고 있는가?
   - 질문에서 요구한 요소(예: 연도, 업종, 사례, 전략 등)를 빠뜨리지 않았는가?

2. **출처 일관성**  
   - 내부 자료와 웹 검색 자료를 구분해서 설명했는가?
   - 내부 자료와 웹 검색 결과가 서로 모순될 경우, 그 차이를 언급했는가?

3. **추측/환상 금지**  
   - 근거가 없는 내용을 단정적으로 말하지 않았는가?
   - "확실하지 않은 부분"은 불확실하다고 명시했는가?

4. **간결성**  
   - 불필요하게 장황한 서론/포장 없이,  
     사용자가 바로 써먹을 수 있는 정보 위주로 정리했는가?

이 자기검열을 통과하지 못한다고 느끼면,
답변을 간단하게 줄이거나,
부족한 부분을 "추가 정보가 필요하다"는 식으로 분리해서 솔직하게 표시하라.

# 정보가 거의/전혀 없을 때의 처리

다음 조건을 만족하면, 곧바로 짧게 “트렌드 검색 결과가 없습니다.”라고 답하고,
그 외의 내용을 지어내지 마라.

- internal_search_tool 결과에 `[NO_INTERNAL_RESULTS]`가 포함되어 있고
- tavily_search 결과에 `[NO_TAVILY_RESULTS]`가 포함되어 있거나,
  혹은 tavily_search 도구가 호출되지 않았고,
  internal_search_tool 결과 텍스트 길이도 매우 짧아서
  (예: 전체 길이가 400자 미만) 질문에 답하기 어렵다고 판단될 때

이 상황에서는 반드시 다음 원칙을 지켜라.
- “내부 DB와 웹 검색 어디에서도 질문에 답할 만한 트렌드 정보를 찾지 못했다”는 사실만 짧게 설명한다.
- 트렌드 내용을 추측해서 만들어내지 않는다.
- 불필요한 일반론(“브랜딩은 중요합니다” 같은 포장)은 붙이지 않는다.
- 사용자가 원할 경우에만, “어떤 키워드나 조건으로 다시 물어보면 좋은지” 정도의 안내만 간단히 덧붙인다.
"""

SUMMARY_PROMPT = """
지금까지의 대화를 한국어로 요약해라.

- 사용자의 주요 질문/목표
- 내부 검색에서 나온 핵심 포인트
- Tavily(웹 검색)에서 얻은 주요 트렌드/사례
- 현재까지의 결론/인사이트

향후 대화에서 참고해야 할 내용만 간단명료하게 정리하고,
불필요한 잡담이나 중복 내용은 과감히 생략해라.
"""


agent = create_agent(
    model=llm,
    tools=[internal_search_tool, external_search_tool],  #tavily_search
    checkpointer=InMemorySaver(),  
    system_prompt=SYSTEM_PROMPT,
    middleware=[
        #QuestionValidatorMiddleware(),
        LoggingMiddleware(),
        SummarizationMiddleware(
            model="gpt-4o-mini",
            max_tokens_before_summary=4000,  # Trigger summarization at 4000 tokens
            messages_to_keep=20,  # Keep last 20 messages after summary
            summary_prompt=SUMMARY_PROMPT
        ),
    ],
)

if __name__ == "__main__":
    config = {"configurable": {"thread_id": "1"}}

    print("질문 시작 (종료하려면 q / quit / exit 입력)")

    while True:
        question = input("\nYou: ")
        if question.lower() in ("q", "quit", "exit"):
            print("종료합니다.")
            break

        result = agent.invoke(
            {"messages": [{"role": "user", "content": question}]},
            config=config,
        )

        messages = result["messages"]
        answer = messages[-1].content

        print("\nAI:", answer)
