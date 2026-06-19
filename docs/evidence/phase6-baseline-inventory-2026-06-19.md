# Phase 6 Baseline Inventory

> 작성일: 2026-06-19
> 브랜치: `phase6-c1-doc-rebaseline` (main = `122f10f`, 0 behind)
> 목적: 현재 코드베이스의 구현 수준을 근거 기반으로 분류하고 C2-C10의 기준점을 설정한다.

---

## 1. 검증 Commands & Results

```bash
# 2026-06-19 10:09 KST
git log --oneline -1          # 122f10f (PR #2 squash merge)
git rev-list --left-right --count origin/main...HEAD  # 0 0
pnpm install --frozen-lockfile  # PASS
pnpm typecheck                  # PASS (29/29 workspace)
pnpm lint                       # PASS
pnpm test                       # PASS (13 files, 218 tests)
pnpm build                      # PASS (19/19 workspace)
```

---

## 2. Workspace Inventory

### 2.1 packages/ (16개)

| 패키지 | 구현 수준 | 테스트 | `any` | 핵심 기능 |
|--------|-----------|--------|-------|-----------|
| `a2a` | implemented | 14 | 0 | 에이전트 간 A2A 프로토콜, 클라이언트/서버/디스커버리 |
| `ag-ui` | implemented | 16 | 0 | 에이전트-UI 바인딩, 이벤트 빌더, AG-UI 서버 |
| `ai-core` | implemented | 6 | 2 | 동적 라우터, 모델 레지스트리, 프로바이더 (OpenAI/Anthropic/Mimo/HuggingFace/RapidMLX/Ollama) |
| `benchmark` | implemented | 20 | 8 | 벤치마크 러너, 메트릭 수집, 리포트 생성 |
| `core` | implemented | 0* | 0 | API 계약 (Zod), 플러그인 매니저, 웹훅, 커뮤니티 레지스트리 |
| `evolution` | implemented | 18 | 9 | 스토어, 스킬 캡처러, 진화 엔진 |
| `hyperagents` | implemented | 12 | 2 | 메타 인지 에이전트, 재귀 개선, 안전 가드 |
| `karpathy-loop` | implemented | 18 | 3 | Karpathy 루프, 코드 패atcher, 테스트 러너, 오버나이트 스케줄러 |
| `knowledge-graph` | partially | 0 | 0 | 지식 그래프, GraphRAG, 수집 파이프라인 (테스트 없음) |
| `lightrag` | implemented | 6 | 0 | LightRAG Python 클라이언트, 인덱스/쿼리 |
| `mcp-adapters` | partially | 0 | 0 | MCP 레지스트리, 3개 앱 어댑터 (테스트 없음) |
| `monitoring` | implemented | 29 | 24 | Langfuse 클라이언트, 추적 미들웨어, 비용 추적, 알림 |
| `orchestrator` | implemented | 0* | 3 | 오케스트레이터, 합의 엔진, 태스크 스플리터 |
| `sandbox` | implemented | 12 | 0 | Docker 샌드박스 매니저, 실행기 |
| `self-evolution` | partially | 0 | 0 | 자가 진화 커널, 경험 버퍼, 코드 합성 (테스트 없음) |
| `workflow` | implemented | 14 | 11 | 워크플로우 엔진, LM Studio 클라이언트, 에이전트 팩토리 |

> *core, orchestrator는 서버 테스트(`server/tests/contract.test.ts`)로 커버

### 2.2 apps/ (2개)

| 앱 | 구현 수준 | 비고 |
|----|-----------|------|
| `desktop` | skeleton | Electron 패키징 스크립트 존재, TypeScript 빌드 연결 |
| `web` | skeleton | Next.js 기본 라우트 (chat, health), AIOS 클라이언트 |

### 2.3 server/

| 항목 | 구현 수준 | 테스트 |
|------|-----------|--------|
| Express API 서버 | implemented | 9 tests (contract) |
| Zod API 계약 검증 | implemented | 9 tests (api-contract) |
| 보안 미들웨어 | implemented | - |
| AI/Workflow/Orchestrator/LightRAG/Knowledge/Monitoring 라우트 | implemented | - |

### 2.4 기타

| 항목 | 상태 |
|------|------|
| `dashboard/` | implemented (정적 HTML) |
| `scripts/` | implemented (verify-all.sh, verify-api.sh 등) |
| `docs/blueprint/` (v1) | superseded (v2로 대체) |
| `docs/blueprint/v2/` | implemented (Phase 5에서 구현) |

---

## 3. 구현 수준 분류 기준

| 레벨 | 정의 | 현재 개수 |
|------|------|-----------|
| **implemented** | 소스 코드 구현 + 테스트 통과 + 빌드 연결 | 13 packages + server |
| **partially implemented** | 소스 코드 존재하나 테스트 없음 또는 핵심 기능 미완 | 3 packages |
| **skeleton** | 디렉토리/스크립트 존재, 핵심 로직 미구현 | 2 apps |

---

## 4. `any` 사용 현황 (소스 코드 기준, C3 기준점)

| 순위 | 패키지 | `any` 수 | 주요 파일 |
|------|--------|----------|-----------|
| 1 | monitoring | 24 | langfuse-client(14), trace-middleware(4), types(3), alert-manager(3) |
| 2 | workflow | 11 | agent-factory(4), workflow-engine(3), types(2), step-runner(1), llm-agent(1) |
| 3 | evolution | 9 | skill-store(5), skill-capturer(2), evolution-engine(2) |
| 4 | benchmark | 8 | benchmark-runner(5), types(3) |
| 5 | karpathy-loop | 3 | test-runner(2), overnight-scheduler(1) |
| 5 | orchestrator | 3 | skill-parser(3) |
| 7 | ai-core | 2 | ollama-client(2) |
| 7 | hyperagents | 2 | safety-guard(1), types(1) |
| - | 나머지 8개 | 0 | - |
| **합계** | | **62** | |

> C3에서 제거 대상: 62건의 `any`를 명시적 타입 또는 `unknown`으로 교체

---

## 5. Blueprint 상태

### v1 (`docs/blueprint/`) — 13개 파일

| 파일 | 상태 |
|------|------|
| `00-BLUEPRINT-OVERVIEW.md` | superseded |
| `01-DEVELOPMENT-PLAN.md` | superseded |
| `02-PR-LIGHT-RAG.md` | superseded |
| `03-PR-MASTRA.md` | superseded |
| `04-PR-OPENSPACE.md` | superseded |
| `05-PR-A2A-PROTOCOL.md` | superseded |
| `06-PR-AG-UI.md` | superseded |
| `07-PR-HYPERAGENTS.md` | superseded |
| `08-PR-OPENHANDS-SANDBOX.md` | superseded |
| `09-PR-EVOAGENTX-BENCHMARK.md` | superseded |
| `10-PR-KARPATHY-LOOP.md` | superseded |
| `11-PR-LANGFUSE.md` | superseded |
| `12-PERFORMANCE-ANALYSIS.md` | superseded |
| `MASTER-DEVELOPMENT-PLAN.md` | superseded |

### v2 (`docs/blueprint/v2/`) — 10개 파일

| 파일 | 상태 |
|------|------|
| `00-BLUEPRINT-OVERVIEW.md` | implemented |
| `PR-01-LANGFUSE.md` | implemented |
| `PR-02-BENCHMARK.md` | implemented |
| `PR-03-LIGHT-RAG.md` | implemented |
| `PR-04-SANDBOX.md` | implemented |
| `PR-05-OPENSPACE.md` | implemented |
| `PR-06-MASTRA.md` | implemented |
| `PR-07-KARPATHY.md` | implemented |
| `PR-08-AGUI.md` | implemented |
| `PR-09-HYPERAGENTS.md` | implemented |
| `PR-10-A2A.md` | implemented |

---

## 6. 오픈소스 재사용 현황

| 오픈소스 | 현재 활용 패키지 | 연결 방식 |
|----------|-----------------|-----------|
| LangGraph.js | orchestrator, workflow | direct import |
| Langfuse SDK | monitoring | direct import |
| LightRAG | lightrag | Python 서버 + HTTP 클라이언트 |
| Zod | server, core | API 계약 검증 |
| Vitest | 전체 | 테스트 프레임워크 |
| Turborepo | 전체 | 빌드 오케스트레이션 |

---

## 7. C2-C10 준비 상태

| Phase | 필요 준비물 | 준비 상태 |
|-------|------------|-----------|
| C2 | LM Studio, Mimo, LightRAG, Langfuse, Docker 실행 환경 | 스크립트 생성 필요 |
| C3 | `any` 62건 위치 파악 | ✅ 완료 (본 문서) |
| C4 | DDD 계층 스켈레톤 | 신규 package 생성 필요 |
| C5 | Mail Intelligence 도메인 모델 | 신규 domain/application package 필요 |
| C6 | 기존 mail-intelligence 앱 분석 | 조사 필요 |
| C7 | 프로젝트 승격 규칙 | C5 완료 후 |
| C8 | 견적/제안서 템플릿 | 기존 AIOS v1/sangfor 조사 필요 |
| C9 | CFO 인계 규칙 | C7 완료 후 |
| C10 | 전체 E2E | C5-C9 완료 후 |

---

**작성**: 2026-06-19 (Hermes Agent, C1 재기준선)
**검증**: source code 변경 없이 문서만 생성
