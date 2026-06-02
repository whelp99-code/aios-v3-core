# Rapid-MLX 설정 및 AIOS 통합 가이드

## 개요

**Rapid-MLX**는 Apple Silicon 전용 초고속 로컬 AI 엔진으로, AIOS의 추론 성능을 극대화합니다. M5 Pro (24GB RAM) 환경에서 최적화되어 있습니다.

---

## 1. Rapid-MLX 설치

### 1.1. 사전 요구사항

- **OS**: macOS (Apple Silicon M-series)
- **메모리**: 24GB 이상 권장
- **Python**: 3.10 이상
- **Git**: 설치 필수

### 1.2. 설치 단계

```bash
# 1. Rapid-MLX 저장소 클론
git clone https://github.com/raullenchai/Rapid-MLX.git
cd Rapid-MLX

# 2. 의존성 설치
pip install -r requirements.txt

# 3. MLX 프레임워크 설치 (Apple Silicon 최적화)
pip install mlx mlx-lm

# 4. 모델 다운로드 (Qwen3.5-9B 4bit 권장)
# Hugging Face에서 자동으로 다운로드됩니다
```

---

## 2. Rapid-MLX 서버 실행

### 2.1. 기본 실행 (포트 8000)

```bash
# Qwen3.5-9B 4bit 모델로 서버 시작
rapid-mlx serve --model qwen3.5-9b-4bit --port 8000

# 또는 명시적으로 모델 경로 지정
rapid-mlx serve \
  --model-path ~/.cache/huggingface/hub/qwen3.5-9b-4bit \
  --port 8000
```

### 2.2. 다른 모델 선택 (M5 Pro 최적화)

| 메모리 | 추천 모델 | 명령어 |
| :--- | :--- | :--- |
| **24GB** | Qwen3.5-9B 4bit | `rapid-mlx serve --model qwen3.5-9b-4bit` |
| **32GB+** | Qwen3.5-27B 4bit | `rapid-mlx serve --model qwen3.5-27b-4bit` |
| **추론 강화** | DeepSeek-R1 14B | `rapid-mlx serve --model deepseek-r1-14b-4bit` |

### 2.3. 서버 상태 확인

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
```

---

## 3. AIOS와의 연동

### 3.1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다:

```bash
# .env
RAPID_MLX_BASE_URL=http://localhost:8000/v1
RAPID_MLX_MODEL=qwen3.5-9b-4bit
RAPID_MLX_TIMEOUT=60000
```

### 3.2. 프로젝트 실행

```bash
# 터미널 1: Rapid-MLX 서버 시작
rapid-mlx serve --model qwen3.5-9b-4bit

# 터미널 2: AIOS 웹 서버 시작
cd aios
pnpm --filter web dev

# 터미널 3: Electron 앱 시작
pnpm --filter desktop dev
```

---

## 4. 성능 최적화

### 4.1. 도구 호출 복구 (Tool Call Recovery)

Rapid-MLX는 내장 파서로 깨진 JSON을 자동 복구합니다. AIOS의 MCP 어댑터는 이를 활용합니다:

```typescript
// packages/ai-core/src/model-router.ts
async routeAndChatWithTools(taskType: TaskType, messages: any[], tools: any[]): Promise<any> {
  const response = await this.client.chatCompletion({
    model,
    messages,
    tools,
    tool_choice: 'auto',
  });
  // Rapid-MLX가 자동으로 도구 호출을 정규화합니다
  return response.choices[0].message;
}
```

### 4.2. 컨텍스트 윈도우 관리

Rapid-MLX의 KV 캐시 트리밍으로 멀티턴 대화 TTFT를 2~5배 개선합니다:

```bash
# 자동 활성화 (별도 설정 불필요)
rapid-mlx serve --model qwen3.5-9b-4bit --enable-kv-cache-trim
```

### 4.3. 추론 분리 (Reasoning Separation)

Chain-of-thought 모델의 추론 과정을 분리하여 모니터링합니다:

```typescript
// 응답에서 reasoning_content 필드 추출
const response = await client.chatCompletion({...});
const reasoning = response.choices[0].message.reasoning_content;
const answer = response.choices[0].message.content;
```

---

## 5. 트러블슈팅

### 5.1. 포트 충돌

```bash
# 다른 포트에서 서버 실행
rapid-mlx serve --model qwen3.5-9b-4bit --port 8001

# .env 파일 업데이트
RAPID_MLX_BASE_URL=http://localhost:8001/v1
```

### 5.2. 메모리 부족

```bash
# 더 작은 모델 사용 (4bit 양자화)
rapid-mlx serve --model qwen3.5-4b-4bit  # 2.4GB RAM

# 또는 양자화 수준 조정
rapid-mlx serve --model qwen3.5-9b --quantize 4bit
```

### 5.3. 연결 실패

```bash
# 헬스 체크
curl -v http://localhost:8000/v1/models

# 방화벽 확인
lsof -i :8000

# 프로세스 재시작
pkill -f "rapid-mlx"
rapid-mlx serve --model qwen3.5-9b-4bit
```

---

## 6. 성능 벤치마크 (M5 Pro 24GB 기준)

| 메트릭 | 값 | 비고 |
| :--- | :--- | :--- |
| **TTFT (첫 토큰)** | 0.08초 | 캐시된 상태 |
| **처리량** | 108 tok/s | Qwen3.5-9B 4bit |
| **메모리 사용** | 5.1GB | Qwen3.5-9B 4bit |
| **vs Ollama** | 3.2배 빠름 | Phi-4 Mini 기준 |

---

## 7. 다음 단계

1. **Week 2**: MCP 어댑터에서 Rapid-MLX의 도구 호출 복구 기능 활용
2. **Week 3**: 오케스트레이터에서 추론 분리 기능으로 모니터링 강화
3. **Week 4**: 지식 베이스 구축 시 고속 추론으로 대량 파일 처리

---

**작성일**: 2026년 5월 25일  
**상태**: Rapid-MLX 통합 완료
