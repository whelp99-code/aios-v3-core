# 공유 추론 엔진 (Rapid-MLX) 통합 가이드

## 개요

**Rapid-MLX 엔진**이 Docker에서 중앙 서비스로 실행됩니다. 다른 모든 에이전트 도구들(Hermes, ai-automation-work-portal, vibe-coding-os 등)이 이 엔진을 공유합니다.

---

## 1. Rapid-MLX 엔진 시작하기

### 1.1. Docker 이미지 빌드 및 실행

```bash
cd /Users/jmpark/Playground/aios-v3-core

# Docker 이미지 빌드
docker build -t rapid-mlx-engine .

# 또는 Docker Compose 사용 (권장)
docker-compose up -d rapid-mlx
```

### 1.2. 엔진 상태 확인

```bash
# 헬스 체크
curl http://localhost:8000/v1/models

# 응답 예시
{
  "object": "list",
  "data": [
    {
      "id": "qwen3.5-9b-4bit",
      "object": "model",
      "owned_by": "qwen"
    }
  ]
}

# Docker 로그 확인
docker-compose logs -f rapid-mlx
```

---

## 2. 다른 에이전트에서 엔진 사용하기

### 2.1. 환경 변수 설정

각 에이전트 프로젝트의 `.env` 파일에 다음을 추가:

```env
# Rapid-MLX 엔진 설정
RAPID_MLX_BASE_URL=http://localhost:8000/v1
RAPID_MLX_MODEL=qwen3.5-9b-4bit
RAPID_MLX_TIMEOUT=60000
RAPID_MLX_MAX_TOKENS=2048
```

또는 `aios-v3-core/.env.agents-example` 파일을 복사:

```bash
cp /Users/jmpark/Playground/aios-v3-core/.env.agents-example /path/to/your-agent/.env
```

### 2.2. Node.js 프로젝트 (Hermes, vibe-coding-os, ai-automation-work-portal)

```typescript
// src/services/ai-engine.ts
import axios from 'axios';

const RAPID_MLX_BASE_URL = process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1';
const MODEL = process.env.RAPID_MLX_MODEL || 'qwen3.5-9b-4bit';

export async function chatWithRapidMLX(messages: any[], tools?: any[]) {
  const payload = {
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  };

  if (tools) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await axios.post(
    `${RAPID_MLX_BASE_URL}/chat/completions`,
    payload,
    { timeout: 60000 }
  );

  return response.data.choices[0].message;
}
```

### 2.3. Python 프로젝트

```python
# src/services/ai_engine.py
import requests
import os

RAPID_MLX_BASE_URL = os.getenv('RAPID_MLX_BASE_URL', 'http://localhost:8000/v1')
MODEL = os.getenv('RAPID_MLX_MODEL', 'qwen3.5-9b-4bit')

def chat_with_rapid_mlx(messages: list, tools: list = None) -> dict:
    payload = {
        'model': MODEL,
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': 2048,
    }
    
    if tools:
        payload['tools'] = tools
        payload['tool_choice'] = 'auto'
    
    response = requests.post(
        f'{RAPID_MLX_BASE_URL}/chat/completions',
        json=payload,
        timeout=60
    )
    
    return response.json()['choices'][0]['message']
```

---

## 3. 아키텍처 흐름도

```
┌───────────────────────────────────────────────────┐
│       Docker (로컬 네트워크 - aios-network)       │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  Rapid-MLX 엔진 (포트 8000)              │    │
│  │  - Model: qwen3.5-9b-4bit               │    │
│  │  - Cache: /app/cache                    │    │
│  │  - Health: /v1/models                   │    │
│  └──────────────────────────────────────────┘    │
│                      ↑                            │
│         HTTP API (localhost:8000/v1)             │
│                      ↑                            │
└───────────────────────────────────────────────────┘
         ↑         ↑         ↑         ↑
         │         │         │         │
    ┌────┴────┐ ┌──┴──┐ ┌───┴───┐ ┌──┴──────┐
    │ Hermes  │ │ AI  │ │ Vibe  │ │ 기타    │
    │         │ │Auto │ │Coding │ │에이전트 │
    └─────────┘ └─────┘ └───────┘ └─────────┘
```

---

## 4. 도구 호출 (Tool Calls) 통합

Rapid-MLX는 LLM 응답에서 도구 호출을 자동으로 정규화합니다:

### 4.1. 도구 정의 및 전달

```typescript
const tools = [
  {
    name: 'search_knowledge_base',
    description: '내부 지식 베이스에서 정보를 검색합니다',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색 쿼리',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'execute_code',
    description: '코드를 실행합니다',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: '실행할 코드',
        },
        language: {
          type: 'string',
          enum: ['python', 'javascript', 'bash'],
        },
      },
      required: ['code', 'language'],
    },
  },
];

const response = await chatWithRapidMLX(messages, tools);

// response.tool_calls가 자동으로 정규화됨
if (response.tool_calls) {
  for (const call of response.tool_calls) {
    const result = await executeToolCall(call.function.name, call.function.arguments);
    // 결과를 메시지에 추가하여 다시 요청
  }
}
```

---

## 5. 성능 최적화

### 5.1. 모델 선택 (M5 Pro 기준)

| 용도 | 권장 모델 | 메모리 | 속도 |
|------|---------|--------|------|
| 일반 대화 | `qwen3.5-9b-4bit` | ~5GB | 108 tok/s |
| 복잡 추론 | `deepseek-r1-14b-4bit` | ~10GB | 72 tok/s |
| 임베딩 | `nomic-embed-text` | ~1GB | - |

### 5.2. KV 캐시 최적화

Rapid-MLX는 자동으로 KV 캐시 트리밍을 활성화합니다 (멀티턴 대화 TTFT 2~5배 개선).

### 5.3. 동시 요청 처리

Docker 메모리 제한:

```yaml
# docker-compose.yml에 추가
services:
  rapid-mlx:
    deploy:
      resources:
        limits:
          memory: 24G
        reservations:
          memory: 20G
```

---

## 6. 트러블슈팅

### 6.1. 포트 충돌

```bash
# 포트 8000이 이미 사용 중인 경우
docker-compose.yml에서 포트 변경:
ports:
  - "8001:8000"  # 호스트 8001 → 컨테이너 8000

# 다른 에이전트에서도 RAPID_MLX_BASE_URL 변경:
RAPID_MLX_BASE_URL=http://localhost:8001/v1
```

### 6.2. 메모리 부족

```bash
# M5 Pro (24GB)에서 대형 모델 실행 불가 시
# docker-compose.yml의 모델 변경:
CMD ["python", "-m", "rapid_mlx.server", "--model", "qwen3.5-9b-4bit"]
```

### 6.3. 느린 초기 다운로드

```bash
# 모델 미리 다운로드 (선택사항)
docker exec rapid-mlx-engine python -c "from mlx_lm import load; load('qwen3.5-9b-4bit')"
```

---

## 7. 엔진 중지 및 재시작

```bash
# 엔진 중지
docker-compose down

# 엔진 재시작
docker-compose up -d rapid-mlx

# 완전 제거 (캐시 초기화)
docker-compose down -v
```

---

**작성일**: 2026년 6월 7일  
**상태**: 공유 추론 엔진 Docker 설정 완료
