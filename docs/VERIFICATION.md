# AIOS 검증 가이드

실제 환경에서 AIOS 전체 스택을 검증하는 절차입니다.

## 사전 요구사항

- Node.js >= 22
- pnpm
- (선택) Rapid-MLX 로컬 서버 — 없어도 Fallback/시뮬레이션 모드로 검증 가능
- (선택) 클라우드 API 키 — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 설정 시 Hybrid Router가 클라우드 엔진 사용

### Hybrid AI Core 환경변수

| 변수 | 설명 |
|------|------|
| `RAPID_MLX_BASE_URL` | 로컬 Rapid-MLX URL (기본: `http://localhost:8000/v1`) |
| `OPENAI_API_KEY` | OpenAI GPT-4o / GPT-4o-mini |
| `ANTHROPIC_API_KEY` | Anthropic Claude 3.5 |
| `HF_TOKEN` / `HUGGINGFACE_API_KEY` | Hugging Face Inference Router (Llama, Qwen, DeepSeek) |
| `AIOS_ENGINE_MODE` | `local` \| `auto` \| `cloud` (기본: **local**, Rapid-MLX) |
| `RAPID_MLX_LOAD` | 로컬 GPU 부하 시뮬레이션 (0-1, Dynamic Resource Allocator) |

## 1단계: 패키지 빌드 + 단위 검증

```bash
cd /path/to/aios-v3-core
pnpm install
./scripts/verify-all.sh
```

검증 항목:
| # | 항목 | 내용 |
|---|------|------|
| 1 | `build:packages` | 6개 패키지 TypeScript 빌드 |
| 2 | Hybrid AI Core | ModelRegistry + DynamicRouter + Multi-engine (incl. HuggingFace) |
| 3 | MCP Adapters | 3개 앱 어댑터 + 도구 호출 |
| 4 | Knowledge Graph | ingest + GraphRAG |
| 5 | Orchestrator | Swarm 워크플로우 → `completed` |
| 6 | Self-Evolution | proposal → approve → apply |
| 7 | Web Build | Next.js 프로덕션 빌드 |

## 2단계: Web 서버 실행

```bash
pnpm build:packages
cd apps/web && pnpm build && pnpm start
# 또는 개발 모드: pnpm dev
```

## 3단계: API 통합 검증

```bash
./scripts/verify-api.sh
# 다른 포트: AIOS_BASE_URL=http://localhost:3001 ./scripts/verify-api.sh
```

검증 항목:
| API | 검증 내용 |
|-----|----------|
| `GET /api/health` | Rapid-MLX 상태 (503=오프라인 OK) |
| `GET /api/mcp/status` | 3개 MCP 어댑터 |
| `GET /api/stats` | 시스템 통계 |
| `POST /api/knowledge` | ingest + GraphRAG query |
| `POST /api/workflow` | Swarm 워크플로우 E2E |
| `GET /api/evolution` | 진화 제안 목록 |
| `POST /api/evolution` | Hot-Patch approve → apply |
| `GET /api/community` | 커뮤니티 목록 |
| `POST /api/webhooks` | Webhook 구독 |

## 4단계: UI 수동 검증 (선택)

1. http://localhost:3000 접속
2. **Swarm Workflow** 토글 ON
3. 명령 입력 → 워크플로우 탭에서 에이전트 진행 확인
4. **지식** 탭 → GraphRAG 질의
5. **진화** 탭 → Hot-Patch 승인/적용

## 5단계: Rapid-MLX 연동 검증 (로컬 Mac)

```bash
rapid-mlx serve --model qwen3.5-9b-4bit
export RAPID_MLX_BASE_URL=http://localhost:8000/v1
./scripts/verify-api.sh  # health → healthy 확인
```

## 예상 결과

### Cloud/CI 환경 (Rapid-MLX 없음)
- Health: `503 unhealthy` — **정상** (Fallback 모드)
- Workflow: `completed` — Fallback LLM으로 E2E 성공
- MCP: `simulated` — **정상**

### 로컬 Mac (Rapid-MLX 실행)
- Health: `200 healthy`
- LLM 응답: 실제 모델 추론

## 한 줄 전체 검증

```bash
pnpm install && ./scripts/verify-all.sh && \
  (cd apps/web && pnpm start &) && sleep 15 && ./scripts/verify-api.sh
```
