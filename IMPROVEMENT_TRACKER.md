# AIOS v3 Core 개선 작업 추적 문서

**시작일**: 2026-06-07
**최종 업데이트**: 2026-06-19 (C1 재기준선)
**목적**: aios-v3-core 프로젝트의 개선사항 검토 및 구현 추적
**상태**: Phase 5 기준선 완료, Phase 6 진입

> ⚠️ 이 문서는 2026-06-19에 현재 코드베이스 기준으로 재작성되었습니다.
> 이전 버전의 "테스트 0개", "Mock 기반", "미구현" 등의 표현은 더 이상 유효하지 않습니다.
> 상세 구현 수준은 `docs/evidence/phase6-baseline-inventory-2026-06-19.md`를 참조하십시오.

---

## 1. 프로젝트 현재 상태 (2026-06-19 기준)

### 1.1 프로젝트 개요
- **이름**: aios-v3-core (AIOS v3.0 코어 엔진)
- **목적**: 하이브리드 AI 코어, 멀티 에이전트 오케스트레이션, 자가 진화형 커널
- **기술 스택**: TypeScript, Node.js, pnpm 모노레포 (Turborepo), Docker, Vitest
- **브랜치**: `phase6-c1-doc-rebaseline` (main = `122f10f`, 0 behind)

### 1.2 아키텍처 구조
```
aios-v3-core/
├── apps/
│   ├── desktop/          # Electron 메인 프로세스
│   └── web/              # Next.js 렌더러 (UI)
├── packages/
│   ├── a2a/              # A2A 프로토콜 (에이전트 간 통신)
│   ├── ag-ui/            # AG-UI 프로토콜 (에이전트-UI 바인딩)
│   ├── ai-core/          # 모델 라우터 & 프로바이더
│   ├── benchmark/        # 벤치마크 러너 & 메트릭
│   ├── core/             # 핵심 공통 모듈 (API 계약, 플러그인)
│   ├── evolution/        # 진화형 스토어 & 엔진
│   ├── hyperagents/      # 메타 인지 에이전트
│   ├── karpathy-loop/    # Karpathy 루프 (자기 개선)
│   ├── knowledge-graph/  # 지식 그래프 & GraphRAG
│   ├── lightrag/         # LightRAG Python 클라이언트
│   ├── mcp-adapters/     # MCP 어댑터 (3개 앱 연동)
│   ├── monitoring/       # Langfuse 추적 & 비용 추적
│   ├── orchestrator/     # 오케스트레이터 & 합의 엔진
│   ├── sandbox/          # Docker 샌드박스 실행
│   ├── self-evolution/   # 자가 진화 커널
│   └── workflow/         # 워크플로우 엔진 & LM Studio 클라이언트
├── server/               # Express API 서버
├── dashboard/            # 정적 대시보드
├── docs/                 # 설계 문서 & 보고서
└── scripts/              # 검증 스크립트
```

### 1.3 검증 상태 (2026-06-19)
| 명령 | 결과 | 상세 |
|------|------|------|
| `pnpm install --frozen-lockfile` | ✅ PASS | - |
| `pnpm typecheck` | ✅ PASS | 29/29 workspace (Turborepo) |
| `pnpm lint` | ✅ PASS | - |
| `pnpm test` | ✅ PASS | 13 파일 / **218 테스트** |
| `pnpm build` | ✅ PASS | 19/19 workspace |
| PR #2 CI | ✅ PASS | verify (20 jobs), 1m41s |
| PR #2 merge | ✅ 완료 | Squash merge `122f10f` |

---

## 2. workspace별 구현 수준 분류

### 2.1 fully implemented — 실제 구현 + 테스트 통과

| 패키지 | 설명 | 테스트 | `any` 수 |
|--------|------|--------|----------|
| `packages/a2a` | A2A 프로토콜 (에이전트 간 통신) | 14 tests | 0 |
| `packages/ag-ui` | AG-UI 프로토콜 (에이전트-UI) | 16 tests | 0 |
| `packages/ai-core` | 모델 라우터, 동적 라우팅, 프로바이더 | 6 tests | 2 (ollama-client) |
| `packages/benchmark` | 벤치마크 러너, 메트릭 수집, 리포트 | 20 tests | 8 |
| `packages/core` | API 계약, 플러그인 매니저 | 0 (서버 테스트로커버) | 0 |
| `packages/evolution` | 스토어, 캡처러, 진화 엔진 | 18 tests | 9 |
| `packages/hyperagents` | 메타 인지, 재귀 개선, 안전 가드 | 12 tests | 2 |
| `packages/karpathy-loop` | 루프, 코드 패atcher, 테스트 러너 | 18 tests | 3 |
| `packages/lightrag` | LightRAG Python 클라이언트 | 6 tests | 0 |
| `packages/monitoring` | Langfuse, 비용 추적, 알림 | 29 tests | 24 |
| `packages/orchestrator` | 오케스트레이터, 합의 엔진 | - | 3 |
| `packages/sandbox` | Docker 샌드박스 매니저 | 12 tests | 0 |
| `packages/workflow` | 워크플로우 엔진, LM Studio, 에이전트 | 14 tests | 11 |
| `server` | Express API, Zod 검증, 보안 미들웨어 | 9 tests | 0 |

### 2.2 partially implemented — 구조 존재, 핵심 로직 미완

| 패키지 | 설명 | 상태 |
|--------|------|------|
| `packages/knowledge-graph` | 지식 그래프, GraphRAG | 소스 코드 존재, 테스트 없음 |
| `packages/mcp-adapters` | MCP 어댑터 (3개 앱) | 소스 코드 존재, 테스트 없음 |
| `packages/self-evolution` | 자가 진화 커널 | 소스 코드 존재, 테스트 없음 |

### 2.3 not yet implemented — 스켈레톤만

| 패키지 | 설명 |
|--------|------|
| `apps/desktop` | Electron 패키징 (빌드 스크립트 존재) |
| `apps/web` | Next.js UI (기본 라우트 존재) |
| `dashboard` | 정적 HTML 대시보드 |

---

## 3. `any` 사용 현황 (소스 코드 기준)

C3(Placeholder 제거와 타입 하드닝)의 기준점:

| 패키지 | `any` 수 | 파일 | 비고 |
|--------|----------|------|------|
| monitoring | 24 | langfuse-client(14), trace-middleware(4), types(3), alert-manager(3) | **최다** |
| workflow | 11 | agent-factory(4), workflow-engine(3), types(2), step-runner(1), llm-agent(1) | |
| evolution | 9 | skill-store(5), skill-capturer(2), evolution-engine(2) | |
| benchmark | 8 | benchmark-runner(5), types(3) | |
| karpathy-loop | 3 | test-runner(2), overnight-scheduler(1) | |
| orchestrator | 3 | skill-parser(3) | |
| ai-core | 2 | ollama-client(2) | |
| hyperagents | 2 | safety-guard(1), types(1) | |
| core | 0 | - | |
| a2a | 0 | - | |
| ag-ui | 0 | - | |
| lightrag | 0 | - | |
| knowledge-graph | 0 | - | |
| sandbox | 0 | - | |
| mcp-adapters | 0 | - | |
| server | 0 | - | |
| **합계** | **62** | | |

---

## 4. 테스트 커버리지 상세

| 패키지 | 테스트 파일 | 테스트 수 | 비고 |
|--------|------------|-----------|------|
| monitoring | monitoring.test.ts | 29 | |
| benchmark | benchmark.test.ts | 20 | |
| evolution | evolution.test.ts | 18 | |
| karpathy-loop | karpathy-loop.test.ts | 18 | |
| ag-ui | ag-ui.test.ts | 16 | |
| workflow | workflow.test.ts | 14 | |
| a2a | a2a.test.ts | 14 | |
| hyperagents | hyperagents.test.ts | 12 | |
| sandbox | sandbox.test.ts | 12 | |
| server/contract | contract.test.ts | 9 | |
| server/api-contract | api-contract.test.ts | 9 | (스키마 테스트) |
| lightrag | lightrag.test.ts | 6 | |
| ai-core | dynamic-router.test.ts | 6 | |
| **합계** | **13 파일** | **218** | |

---

## 5. PR #2 최종 상태

| 항목 | 값 |
|------|-----|
| PR 번호 | #2 |
| 제목 | [codex] complete Phase 5 integration hardening |
| 브랜치 | `codex/phase5-review-hardening` → `main` |
| HEAD | `b889a06` |
| merge commit | `122f10f` (Squash) |
| merge 일시 | 2026-06-19T01:08:36Z |
| CI | verify (20 jobs) PASS |
| 변경 파일 | 206 files, +24,935 / -4,645 |
| 상태 | **MERGED** ✅ |

---

## 6. Blueprint 상태

| Blueprint | 상태 | 비고 |
|-----------|------|------|
| `docs/blueprint/` (v1, 13개) | **superseded** | v2로 대체됨 |
| `docs/blueprint/v2/` (10개) | **implemented** | Phase 5에서 구현 완료 |

Blueprint 상세는 `docs/evidence/phase6-baseline-inventory-2026-06-19.md` 참조.

---

## 7. 운영 검증 미완료 항목

다음 항목은 코드는 구현되었으나 실제 런타임 연결 검증이 필요합니다:

| 항목 | 상태 | 검증 방법 |
|------|------|-----------|
| Docker sandbox 이미지 실행 | 미검증 | `docker compose up` + 테스트 |
| LightRAG 실제 연결 | 미검증 | `packages/lightrag/server/main.py` 실행 |
| Langfuse 실제 연결 | 미검증 | `packages/monitoring/docker/docker-compose.langfuse.yml` |
| LM Studio 연결 | 미검증 | `packages/workflow/src/lm-studio-client.ts` |
| Mimo 클라우드 연결 | 미검증 | `packages/ai-core/src/providers/mimo-cloud-provider.ts` |
| Electron 패키징 | 미검증 | `pnpm --filter aios-desktop package` |

> 상세 검증은 C2 (실제 연동 Smoke와 Evidence 자동화)에서 수행합니다.

---

## 8. 다음 단계 (Phase 6 로드맵)

| Phase | 목표 | 상태 |
|-------|------|------|
| C0 | Phase 5 기준선 마감 | ✅ 완료 |
| C1 | 현재 상태 재기준선과 문서 정리 | 🔄 진행 중 |
| C2 | 실제 연동 Smoke와 Evidence 자동화 | ⏳ 대기 |
| C3 | Placeholder 제거와 타입 하드닝 | ⏳ 대기 |
| C4 | DDD 모듈형 모놀리스 기준 구조 | ⏳ 대기 |
| C5 | Mail Intelligence 도메인과 Canonical Persistence | ⏳ 대기 |
| C6 | 기존 Mail Intelligence Adapter와 분석 Pipeline | ⏳ 대기 |
| C7 | Project Automation과 승인 큐 | ⏳ 대기 |
| C8 | 견적·제안서·POC 자동화 | ⏳ 대기 |
| C9 | 완료·CFO 인계·유지보수·개선 생명주기 | ⏳ 대기 |
| C10 | 관측성, E2E, 보안, 릴리스 준비 | ⏳ 대기 |

---

**최종 업데이트**: 2026-06-19
**문서 관리자**: Hermes Agent (C1 재기준선)
**다음 검토일**: C2 완료 시
