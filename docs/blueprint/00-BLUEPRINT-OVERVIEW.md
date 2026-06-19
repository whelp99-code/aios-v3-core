# 🏗️ AIOS v3 Core 고도화 블루프린트

> **Version**: 1.0
> **Date**: 2026-06-10
> **Author**: Hermes Agent (PM/설계)
> **Status**: Draft

---

## 1. 블루프린트 개요

### 1.1 목적

F-aios-v3-core 프로젝트를 오픈소스 생태계와 통합하여 프로덕션 수준의 AI 에이전트 엔진으로 고도화하는 전체 설계서입니다.

### 1.2 범위

| 구분 | 내용 |
|------|------|
| **대상 프로젝트** | F-aios-v3-core (6개 패키지) |
| **수혜 프로젝트** | AIOS v1, sangfor-mcp, sangfor-workflow, vibe-coding-os |
| **적용 불가** | Graph-R1, angeles-app, translator, local-llm-wiki, sliding-jump |
| **기간** | 6개월 (3개フェーズ) |
| **총 PR** | 10개 |

### 1.3 핵심 목표

```
현재: Mock 서버 기반, 테스트 0개, 코드 6,117줄
목표: 프로덕션 검증, 테스트 200+개, 오픈소스 통합
```

---

## 2. 기술 아키텍처

### 2.1 현재 구조

```
F-aios-v3-core/
├─ packages/
│  ├─ ai-core/          (1,247줄) — Rapid-MLX 클라이언트
│  ├─ core/             (504줄)   — 핵심 런타임
│  ├─ knowledge-graph/  (584줄)   — 지식 그래프 (36줄 GraphRAG)
│  ├─ mcp-adapters/     (721줄)   — MCP 어댑터
│  ├─ orchestrator/     (1,321줄) — 오케스트레이터
│  └─ self-evolution/   (970줄)   — 자기 진화
├─ apps/
│  ├─ web/              — Next.js UI
│  └─ desktop/          — Electron
└─ docs/                — 설계 문서
```

### 2.2 목표 구조 (고도화 후)

```
F-aios-v3-core/
├─ packages/
│  ├─ ai-core/          → LM Studio + 멀티 프로바이더 강화
│  ├─ core/             → 플러그인/웹훅 유지
│  ├─ knowledge-graph/  → ★ LightRAG 통합 (36줄 → 500줄+)
│  ├─ mcp-adapters/     → ★ A2A 프로토콜 추가
│  ├─ orchestrator/     → ★ Mastra 기반 재설계
│  ├─ self-evolution/   → ★ OpenSpace + Hyperagents 통합
│  ├─ sandbox/          (신규) — ★ OpenHands 패턴 Docker 격리
│  ├─ benchmark/        (신규) — ★ EvoAgentX 벤치마크
│  └─ a2a-protocol/     (신규) — ★ Google A2A 어댑터
├─ apps/
│  ├─ web/              → ★ AG-UI 스트리밍 UI
│  └─ desktop/          → Electron 유지
├─ monitoring/          (신규) — ★ Langfuse 통합
└─ docs/blueprint/      — 이 문서
```

---

## 3. 오픈소스 통합 매핑

| # | 오픈소스 | Stars | v3 패키지 | 적용 범위 |
|---|---------|-------|----------|----------|
| 1 | **LightRAG** | 36.3k | knowledge-graph | GraphRAG 재구현 |
| 2 | **Mastra** | 10k | orchestrator | 워크플로우 DSL |
| 3 | **OpenSpace** | — | self-evolution | 스킬 자가 진화 |
| 4 | **Google A2A** | 15k | a2a-protocol (신규) | 에이전트 간 통신 |
| 5 | **AG-UI** | 8k | apps/web | 실시간 UI |
| 6 | **Hyperagents** | — | self-evolution | 메타 인지 |
| 7 | **OpenHands** | 76k | sandbox (신규) | 코드 실행 |
| 8 | **EvoAgentX** | — | benchmark (신규) | 성능 측정 |
| 9 | **Karpathy Loop** | — | self-evolution | 야간 자동 학습 |
| 10 | **Langfuse** | 8k | monitoring (신규) | 관측성 |

---

## 4. phased 개발 계획

### Phase 1: 기반 고도화 (4주)

| 주차 | PR | 내용 | 우선순위 |
|------|-----|------|---------|
| 1주 | PR-10 | Langfuse 관측성 구축 | P0 |
| 1주 | PR-08 | EvoAgentX 벤치마크 프레임워크 | P0 |
| 2주 | PR-01 | LightRAG 도입 | P0 |
| 3주 | PR-03 | OpenSpace 스킬 진화 | P1 |
| 4주 | PR-07 | OpenHands 샌드박스 | P1 |

### Phase 2: 워크플로우 강화 (4주)

| 주차 | PR | 내용 | 우선순위 |
|------|-----|------|---------|
| 5주 | PR-02 | Mastra 오케스트레이터 | P1 |
| 6주 | PR-09 | Karpathy Loop 자동 학습 | P2 |
| 7주 | PR-05 | AG-UI 실시간 UI | P2 |
| 8주 | PR-06 | Hyperagents 메타 인지 | P2 |

### Phase 3: 에이전트 생태계 (4주)

| 주차 | PR | 내용 | 우선순위 |
|------|-----|------|---------|
| 9주 | PR-04 | Google A2A 프로토콜 | P2 |
| 10-12주 | — | 통합 테스트 + 프로덕션 검증 | P0 |

---

## 5. 예상 성과

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| 검색 정확도 | 30% | 84% | +180% |
| 토큰 비용 | 100% | 54% | -46% |
| 테스트 커버리지 | 0% | 80%+ | ∞ |
| 코드 라인 | 6,117줄 | ~8,000줄 | +30% |
| 에이전트 협업 | 3개 | 100+ | +3,233% |
| 모니터링 | 0% | 100% | ∞ |

---

## 6. 리스크 관리

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 오픈소스 버전 불일치 | 중간 | 높음 | 버전 고정 + 호환성 테스트 |
| LM Studio 성능 병목 | 낮음 | 높음 | 로컬/클라우드 하이브리드 |
| Docker 리소스 부족 | 중간 | 중간 | 메모리 제한 점진적 확대 |
| 학습 데이터 부족 | 높음 | 중간 | 자체 실행 로그 수집 |
| 보안 이슈 | 낮음 | 높음 | 네트워크 차단 + 격리 |

---

## 7. 문서 색인

| 문서 | 내용 |
|------|------|
| [01-DEVELOPMENT-PLAN.md](./01-DEVELOPMENT-PLAN.md) | 상세 개발 계획서 |
| [02-PR-LIGHT-RAG.md](./02-PR-LIGHT-RAG.md) | PR #1: LightRAG |
| [03-PR-MASTRA.md](./03-PR-MASTRA.md) | PR #2: Mastra |
| [04-PR-OPENSPACE.md](./04-PR-OPENSPACE.md) | PR #3: OpenSpace |
| [05-PR-A2A-PROTOCOL.md](./05-PR-A2A-PROTOCOL.md) | PR #4: Google A2A |
| [06-PR-AG-UI.md](./06-PR-AG-UI.md) | PR #5: AG-UI |
| [07-PR-HYPERAGENTS.md](./07-PR-HYPERAGENTS.md) | PR #6: Hyperagents |
| [08-PR-OPENHANDS-SANDBOX.md](./08-PR-OPENHANDS-SANDBOX.md) | PR #7: OpenHands |
| [09-PR-EVOAGENTX-BENCHMARK.md](./09-PR-EVOAGENTX-BENCHMARK.md) | PR #8: EvoAgentX |
| [10-PR-KARPATHY-LOOP.md](./10-PR-KARPATHY-LOOP.md) | PR #9: Karpathy Loop |
| [11-PR-LANGFUSE.md](./11-PR-LANGFUSE.md) | PR #10: Langfuse |
| [12-PERFORMANCE-ANALYSIS.md](./12-PERFORMANCE-ANALYSIS.md) | 성능 분석 비교표 |

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
