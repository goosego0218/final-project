# Kanana Safeguard GPU 서버

독립적으로 실행 가능한 Kanana Safeguard 모델 서버

## 설치

```bash
cd guardrails_server
pip install -r requirements.txt
```

## 실행

```bash
python main.py
```

서버는 `http://0.0.0.0:8001`에서 실행됩니다.

## API 엔드포인트

### POST /guardrails/check

텍스트 안전성 검사

**요청:**
```json
{
    "text": "사용자 입력 텍스트",
    "assistant_prompt": ""  // Input 체크 시 빈 문자열, Output 체크 시 AI 응답
}
```

**응답:**
```json
{
    "is_safe": true,
    "risk_code": null,
    "raw_output": "<SAFE>"
}
```

### GET /health

서버 상태 확인

### GET /

서버 정보

## 환경 변수

`.env` 파일 (선택적):
```
# 필요시 추가 설정
```

## 모델 저장 위치

- Hugging Face 캐시: `~/.cache/huggingface/hub/`
- 로컬 모델: 프로젝트 루트의 `models/` 폴더

