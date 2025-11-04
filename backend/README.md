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
│   │   ├── brand_agent.py            # ⭐ 브랜드 정보 수집 에이전트
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