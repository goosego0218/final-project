### 최소 필수 구조 (MVP)
backend/
├── app/
│   ├── main.py                       # ✅ 현재 있음
│   │
│   ├── api/                          # 최소 API
│   │   ├── __init__.py
│   │   ├── auth.py                   # ✅ 인증 (소셜 로그인)
│   │   ├── chat.py                   # ⭐ 핵심: 채팅 API (모든 상호작용)
│   │   ├── status.py                 # ⭐ 상태 조회 (프로젝트, 브랜드 정보)
│   │   ├── health.py                 # ✅ 헬스체크
│   │   └── dbcheck.py                # ✅ DB 체크
│   │
│   ├── core/
│   │   └── config.py                 # ✅ 설정
│   │
│   ├── db/
│   │   ├── session.py                # ✅ DB 세션
│   │   └── base.py                   # ⭐ Base 클래스 (모델 상속용)
│   │
│   ├── models/                       # 필수 데이터 모델
│   │   ├── user.py                   # ⭐ 사용자
│   │   ├── project.py                # ⭐ 프로젝트 (브랜드 + 콘텐츠)
│   │   └── brand.py                  # ⭐ 브랜드 정보 (10개 항목 저장)
│   │
│   ├── schemas/                      # Pydantic 스키마
│   │   ├── chat.py                   # ⭐ 채팅 요청/응답
│   │   ├── brand.py                  # ⭐ 브랜드 정보
│   │   └── project.py                # ⭐ 프로젝트
│   │
│   ├── services/
│   │   ├── chat_service.py           # ⭐ 핵심: 채팅 처리
│   │   ├── brand_service.py          # ⭐ 브랜드 정보 관리
│   │   └── auth_service.py           # ✅ 인증 서비스
│   │
│   ├── agents/                       # 필수 에이전트
│   │   ├── brandbot/                 # ✅ Brandbot LangGraph 에이전트
│   │   └── strategy_agent.py         # ⭐ 전략 제안 에이전트 (선택)
│   │
│   ├── graphs/                       # LangGraph 워크플로우
│   │   ├── conversation_graph.py     # ⭐ 핵심: 대화 흐름 그래프
│   │   └── nodes/                    # 필수 노드들
│   │       ├── brand_nodes.py        # ⭐ 브랜드 수집 노드
│   │       └── decision_nodes.py     # ⭐ 사용자 선택 분기 노드
│   │
│   ├── mcp/                          # MCP 서버
│   │   ├── server.py                 # ✅ MCP 서버
│   │   └── tools/                     # 필수 MCP 도구
│   │       ├── database_tools.py     # ✅ DB 도구
│   │       └── brand_tools.py        # ⭐ 브랜드 저장/조회 도구
│   │
│   ├── llm/                          # LLM 통합 (최소)
│   │   ├── client.py                 # ⭐ LLM 클라이언트 (OpenAI)
│   │   └── prompts.py                # ⭐ 프롬프트 템플릿
│   │
│   └── utils/
│       └── __init__.py
│
└── mcp_server.py                     # ✅ 독립 MCP 서버



### 가드레일 구현 구조(예시)
backend/
├── app/
│   ├── guardrails/                    # 가드레일 모듈
│   │   ├── __init__.py
│   │   ├── base_guardrail.py          # 기본 가드레일 인터페이스
│   │   ├── content_guardrails.py      # 콘텐츠 검증
│   │   │   ├── prohibited_words_check     # 금지어 검사
│   │   │   ├── copyright_check            # 저작권 검사
│   │   │   ├── quality_check              # 품질 검사 (해상도, 형식 등)
│   │   │   └── brand_consistency_check    # 브랜드 일관성 검사
│   │   ├── input_guardrails.py        # 입력 검증
│   │   │   ├── pii_detection             # 개인정보 탐지
│   │   │   ├── spam_detection            # 스팸 탐지
│   │   │   ├── content_moderation         # 콘텐츠 모더레이션
│   │   │   └── input_validation          # 입력 유효성 검사
│   │   ├── output_guardrails.py       # 출력 검증
│   │   │   ├── response_quality          # 응답 품질 검사
│   │   │   ├── safety_check              # 안전성 검사
│   │   │   └── format_validation         # 형식 검증
│   │   ├── policy_guardrails.py       # 정책 기반 가드레일
│   │   │   ├── moderation_policy         # 모더레이션 정책
│   │   │   ├── quality_policy            # 품질 정책
│   │   │   └── compliance_policy        # 규정 준수 정책
│   │   └── middleware/                # 미들웨어
│   │       ├── guardrail_middleware.py  # 가드레일 미들웨어
│   │       └── validation_middleware.py # 검증 미들웨어
│   │
│   ├── graphs/
│   │   ├── conversation_graph.py
│   │   └── nodes/
│   │       ├── guardrail_nodes.py      # 가드레일 노드
│   │       │   ├── input_validation_node
│   │       │   ├── content_check_node
│   │       │   ├── output_validation_node
│   │       │   └── moderation_node
│   │       └── ...
│   │
│   └── services/
│       └── guardrail_service.py        # 가드레일 서비스

## Brandbot 에이전트 통합 (2025-11-07)

- `app/agents/brandbot` 디렉터리에 LangGraph 기반 Brandbot 패키지를 벤더링했습니다.
- `app/services/brandbot_service.py`가 세션/그래프 생명주기를 관리하며, 다른 에이전트와 구분된 서비스 계층을 제공합니다.
- `app/api/brandbot.py` 라우터를 통해 FastAPI로 노출되며 Swagger에서 별도 Tag(`Brandbot Agent`)로 확인할 수 있습니다.

### 환경 변수

Brandbot은 OpenAI 및 Tavily API를 사용하므로 `.env`(또는 시스템 환경 변수)에 아래 값을 설정하세요.

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL_CHAT=gpt-4o-mini
OPENAI_MODEL_EMBED=text-embedding-3-small
TAVILY_API_KEY=tvly-...
SQLITE_PATH=brandbot.db          # 프로젝트 메타 저장용 (기본값: brandbot.db)
VECTOR_BACKEND=chroma            # 또는 faiss
```

> Tavily 키가 없으면 트렌드 추천 단계에서 폴백 메시지가 반환됩니다. OpenAI 키가 없으면 대부분의 노드가 정상 동작하지 않습니다.

### 설치 및 실행

```
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Swagger 테스트 플로우

1. `POST /brandbot/sessions` – 새 세션을 생성하거나 `session_id`와 `reset=true`로 초기화.
2. `POST /brandbot/sessions/{session_id}/messages` – 사용자 발화 전달.
3. `GET /brandbot/sessions/{session_id}` – 현재 수집 상태/스냅샷 확인.
4. `POST /brandbot/sessions/{session_id}/reset` – 동일 세션을 초기 상태로 되돌림.

응답에는 `brand_draft`, `trend_recos`, `snapshot_text`, `messages`(LangChain 메시지 직렬화) 등이 포함되며, 추후 다른 에이전트도 동일 패턴으로 확장할 수 있도록 분리된 모듈 구조를 유지합니다.