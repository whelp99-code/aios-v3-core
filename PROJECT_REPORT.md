# AIOS v3 Core 프로젝트 분석 보고서

**작성일**: 2026-06-12  
**프로젝트 경로**: `/Users/jmpark/Documents/Playground/F - aios-v3-core`  
**상태**: ⚠️ **폐기됨 (Abandoned)** — 2026-06 중단

---

## 1. 기술 스택

| 분류 | 기술 |
|------|------|
| **언어** | TypeScript 5.x |
| **런타임** | Node.js ≥ 22.0.0 |
| **패키지 관리** | pnpm (workspace 모노레포) |
| **프론트엔드 (Web)** | Next.js 16.2.6 + React 19.2.4 + Tailwind CSS 4 |
| **프론트엔드 (Desktop)** | Electron 33 |
| **백엔드 서버** | Express 4.21 |
| **AI 추론 엔진** | Rapid-MLX 0.6.79 (Python 3.10, Apple Silicon 최적화) |
| **AI 모델** | qwen3.5-9b-4bit / 8bit |
| **워크플로우 엔진** | Mastra Core 1.40.0, 자체 WorkflowEngine |
| **샌드박스** | Dockerode (Docker 기반 격리 실행) |
| **테스트** | Vitest 3.2.6 |
| **컨테이너** | Docker + Docker Compose |
| **HTTP 클라이언트** | Axios |
| **Linting** | ESLint 9 |

---

## 2. 데이터베이스

**외부 데이터베이스 없음.** 모든 상태는 인메모리(Map)로 관리:

- `workflowStore: Map<string, any>` — 워크플로우 정의 및 실행 이력
- `workflowSessionManager` — 워크플로우 세션 상태
- Knowledge Graph store — 인메모리 그래프 (nodes/edges)
- Experience Buffer — 학습 경험 데이터
- Policy Store — 자가 진화 학습 정책
- Hot Patch Proposals — 코드 개선 제안

> 프로토타입 수준이므로 영속성 있는 저장소가 설계되지 않았음.

---

## 3. 포트 번호

| 서비스 | 포트 | 설명 |
|--------|------|------|
| **Express API 서버** | `3200` | 워크플로우 CRUD 및 실행 API |
| **Next.js Web** | `3000` (기본) | 프론트엔드 웹 앱 |
| **Rapid-MLX 추론 엔진** | `8000` (내부) → `8001` (호스트 매핑) | Docker 컨테이너 내 OpenAI 호환 API |
| **Electron Desktop** | N | 내장된 Next.js를 Electron에서 로드 |

---

## 4. 현재 상태

| 항목 | 상태 |
|------|------|
| **개발 상태** | 🛑 **중단됨** (2026-06) |
| **최근 커밋** | `c92044f` — 8개 패키지 테스트 코드 작성 완료 |
| **총 커밋 수** | 33개 |
| **브랜치** | main + 15개 feature 브랜치 (cursor/*) |
| **원격 저장소** | `https://github.com/whelp99-code/aios-v3-core.git` |
| **README** | 폐기 공지 게시됨 |
| **DEPRECATED.md** | 프로젝트 abandon 표시 |
| **npm deprecated** | package.json에 `"deprecated"` 필드 포함 |
| **node_modules** | 설치됨 (일부 패키지) |
| **dist/** | 빌드产物 존재 (일부 패키지) |

---

## 5. 주요 기능

### 5.1 하이브리드 AI 코어 (`@aios/ai-core`)
- Rapid-MLX 로컬 추론 엔진 연동 (Apple Silicon 최적화)
- 클라우드 프로바이더 통합 (HuggingFace, Mimo 등)
- 동적 모델 라우팅 (비용/성능/보안 기반)
- 폴백 메커니즘

### 5.2 워크플로우 엔진 (`@aios/workflow`)
- 단계별(step-by-step) 워크플로우 실행
- 에이전트 팩토리 (LLM Agent, Planner, Executor, Critic)
- LM Studio 클라이언트 연동
- 사전 정의된 워크플로우: Sangfor 정책 점검, 메일 분석, 코드 리뷰, 서버 모니터링

### 5.3 오케스트레이터 (`@aios/orchestrator`)
- 멀티 에이전트 오케스트레이션
- 에이전트 간 합의 메커니즘 (프로토타입)
- 작업 분배 및 상태 관리

### 5.4 자가 진화 (`@aios/self-evolution`)
- 경험 버퍼 (Experience Buffer)
- 학습 정책 저장소 (Learned Policy Store)
- 개선 분석기 (Improvement Analyzer)
- 개선 적용기 (Improvement Applier)
- Hot Patch 시스템 (코드 자동 개선 제안)
- 연속 학습 커널 (Continuous Learning Kernel)
- 코드 합성 엔진 (Code Synthesis)
- HuggingFace 데이터셋 로더

### 5.5 지식 그래프 (`@aios/knowledge-graph`)
- 인메모리 지식 그래프 스토어
- 크로스 프로젝트 메모리
- 지식 검증기 (Knowledge Lint)
- 데이터 인제스천 파이프라인

### 5.6 MCP 어댑터 (`@aios/mcp-adapters`)
- Model Context Protocol 연동
- 3개 앱 간 MCP 통합

### 5.7 샌드박스 (`@aios/sandbox`)
- Docker 기격 코드 격리 실행
- OpenHands 패턴 차용

### 5.8 기타 패키지
- `@aios/monitoring` — 모니터링
- `@aios/benchmark` — 벤치마크
- `@aios/lightrag` — LightRAG 통합
- `@aios/evolution` — 진화 모듈
- `@aios/ag-ui` — AG-UI 프로토콜
- `@aios/a2a` — Agent-to-Agent 통신
- `@aios/karpathy-loop` — Karpathy 루프 패턴
- `@aios/hyperagents` — 하이퍼에이전트 시스템

---

## 6. API 엔드포인트

### 6.1 Express 서버 (포트 3200)

| Method | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/health` | 헬스 체크 |
| `GET` | `/api/workflows` | 워크플로우 목록 조회 |
| `GET` | `/api/workflows/:id` | 워크플로우 단건 조회 |
| `POST` | `/api/workflows` | 워크플로우 생성 |
| `DELETE` | `/api/workflows/:id` | 워크플로우 삭제 |
| `POST` | `/api/workflow/execute` | 워크플로우 실행 |

### 6.2 Next.js API Routes (Web 앱)

| Method | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/chat` | Rapid-MLX 채팅 (OpenAI 호환) |
| `GET` | `/api/health` | 하이브리드 엔진 상태 확인 |
| `GET` | `/api/engines` | 엔진/모델 목록 조회 |
| `POST` | `/api/engines` | 엔진 선호도 업데이트 |
| `GET` | `/api/stats` | 시스템 통계 조회 |
| `POST` | `/api/workflow` | 워크플로우 세션 시작 |
| `GET` | `/api/workflow` | 워크플로우 세션 조회 |
| `POST` | `/api/workflow/[id]/approve` | 워크플로우 승인 |
| `GET` | `/api/evolution` | 진화 제안/통계 조회 |
| `POST` | `/api/evolution` | 진화 제안 승인/거부/적용 |
| `GET` | `/api/knowledge` | 지식 그래프 조회 |
| `POST` | `/api/knowledge` | 지식 쿼리/검증/인제스트 |
| `GET` | `/api/plugins` | 플러그인 목록 조회 |
| `POST` | `/api/plugins` | 플러그인 로드/실행 |
| `GET` | `/api/training` | 학습 상태 조회 |
| `POST` | `/api/training` | 학습 실행/초기화 |
| `GET` | `/api/community` | 커뮤니티 기여 목록 |
| `POST` | `/api/community` | 기여 게시 |
| `GET` | `/api/mcp/status` | MCP 어댑터 상태 확인 |
| `GET` | `/api/webhooks` | 웹훅 구독 목록 |
| `POST` | `/api/webhooks` | 웹훅 구독 |
| `DELETE` | `/api/webhooks` | 웹훅 구독 해제 |

---

## 7. 연결 관계

```
┌─────────────────────────────────────────────────────┐
│                    클라이언트                         │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Web (Next.js)│  │ Desktop (Electron)            │
│  │  :3000        │  │ 내장 Next.js  │                │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                          │
│         ▼                  ▼                          │
│  ┌──────────────────────────────────┐               │
│  │     Next.js API Routes           │               │
│  │  /api/chat, /api/workflow, etc.  │               │
│  └──────┬────────────┬──────────────┘               │
│         │            │                                │
│         ▼            ▼                                │
│  ┌────────────┐  ┌─────────────────┐                │
│  │ Express API │  │ @aios/* 패키지   │                │
│  │ 서버 :3200  │  │ (인메모리)        │                │
│  └──────┬─────┘  └────────┬────────┘                │
│         │                  │                          │
│         ▼                  ▼                          │
│  ┌──────────────────────────────────┐               │
│  │    Rapid-MLX 추론 엔진 (Docker)   │               │
│  │    :8000 (내부) → :8001 (호스트)   │               │
│  │    qwen3.5-9b 모델               │               │
│  └──────────────────────────────────┘               │
└─────────────────────────────────────────────────────┘
```

**핵심 의존성:**
- `web` → `@aios/core`, `@aios/ai-core`, `@aios/mcp-adapters`, `@aios/orchestrator`
- `server` → `@aios/workflow`
- `@aios/workflow` → `@mastra/core`
- `@aios/sandbox` → `dockerode`
- `/api/chat` → Rapid-MLX 엔진 (OpenAI 호환 HTTP)
- `/api/health`, `/api/engines` → `@aios/ai-core` (하이브리드 엔진 상태)

---

## 8. 패키지 구조

```
F - aios-v3-core/
├── apps/
│   ├── web/                    # Next.js 16 프론트엔드 (12개 API routes)
│   └── desktop/                # Electron 데스크톱 앱
├── packages/
│   ├── a2a/                    # Agent-to-Agent 통신
│   ├── ag-ui/                  # AG-UI 프로토콜
│   ├── ai-core/                # Rapid-MLX 클라이언트 & 모델 라우터
│   ├── benchmark/              # 벤치마크 도구
│   ├── core/                   # 핵심 공통 모듈 (@aios/core)
│   ├── evolution/              # 진화 모듈
│   ├── hyperagents/            # 하이퍼에이전트 시스템
│   ├── karpathy-loop/          # Karpathy 루프 패턴
│   ├── knowledge-graph/        # 지식 그래프
│   ├── lightrag/               # LightRAG 통합
│   ├── mcp-adapters/           # MCP 어댑터
│   ├── monitoring/             # 모니터링
│   ├── orchestrator/           # 멀티 에이전트 오케스트레이터
│   ├── sandbox/                # Docker 기반 코드 샌드박스
│   ├── self-evolution/         # 자가 진화 커널
│   └── workflow/               # 워크플로우 엔진 (Mastra 기반)
├── server/                     # Express API 서버
├── dashboard/                  # 정적 HTML 대시보드
├── docs/                       # 설계 문서 (14개 파일)
├── scripts/                    # 검증/학습 스크립트
├── skills/                     # AI 스킬 정의
├── examples/                   # 예제 코드
├── rapid-mlx-cache/            # Rapid-MLX 캐시
├── rapid-mlx-env/              # Rapid-MLX 환경
├── mock_server.py              # Rapid-MLX Mock 서버 (Python)
├── docker-compose.yml          # Docker Compose 설정
├── Dockerfile                  # Rapid-MLX 컨테이너
├── package.json                # 모노레포 루트
├── pnpm-workspace.yaml         # pnpm workspace 설정
└── vitest.config.ts            # 테스트 설정
```

---

## 요약

AIOS v3 Core는 **Rapid-MLX 기반 하이브리드 AI 코어**를 중심으로 한 모노레포 프로젝트로, Apple Silicon에서 로컬 LLM 추론과 클라우드 LLM을 통합하는 아키텍처를 구현했습니다. 16개의 패키지와 Next.js/Electron 기반 UI, Express API 서버를 포함하며, 워크플로우 실행, 멀티 에이전트 오케스트레이션, 자가 진화, 지식 그래프 등의 기능을 프로토타입 수준으로 구현했습니다. 2026년 6월 개발이 중단되어 현재는 **폐기 상태**입니다.
