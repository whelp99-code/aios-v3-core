# 🏗️ F-aios-v3-core 고도화 블루프린트 v2

> **Version**: 2.0
> **Date**: 2026-06-10
> **Phase**: 4 (3순위)
> **Duration**: 12주 (6개월 → 3개월로 단축)
> **Status**: Draft

---

## 1. 프로젝트 개요

### 1.1 목적

F-aios-v3-core의 6개 패키지를 Mock 기반에서 프로덕션 수준으로 고도화하고, 10개 오픈소스를 통합하여 실제 동작하는 AI 에이전트 엔진으로 전환합니다.

### 1.2 현재 상태

```
F-aios-v3-core/
├─ packages/
│  ├─ ai-core/          (1,247줄) — Rapid-MLX 클라이언트
│  ├─ core/             (504줄)   — 핵심 런타임
│  ├─ knowledge-graph/  (584줄)   — GraphRAG (36줄)
│  ├─ mcp-adapters/     (721줄)   — MCP 어댑터
│  ├─ orchestrator/     (1,321줄) — 오케스트레이터
│  └─ self-evolution/   (970줄)   — 자기 진화
├─ apps/
│  └─ web/              — Next.js UI
└─ docs/blueprint/      — 이 문서

총 코드: 6,117줄
테스트: 0개
GitHub Stars: 0
```

### 1.3 목표 상태

```
F-aios-v3-core/
├─ packages/
│  ├─ ai-core/          → LM Studio + 멀티 프로바이더
│  ├─ core/             → 플러그인/웹훅 유지
│  ├─ knowledge-graph/  → ★ LightRAG 통합
│  ├─ mcp-adapters/     → ★ A2A 프로토콜 추가
│  ├─ orchestrator/     → ★ Mastra 기반 재설계
│  ├─ self-evolution/   → ★ OpenSpace + Hyperagents
│  ├─ sandbox/          (신규) — Docker 격리
│  ├─ benchmark/        (신규) — 성능 측정
│  └─ a2a-protocol/     (신규) — 에이전트 협업
├─ apps/
│  └─ web/              → ★ AG-UI 스트리밍
├─ monitoring/          (신규) — Langfuse
└─ tests/               → 200+개

총 코드: ~12,000줄
테스트: 200+개
GitHub Stars: 100+
```

---

## 2. 오픈소스 통합 전략

### 2.1 레고 블록 조립 원칙

```
❌ 직접 구현하지 않는다
✅ 기존 오픈소스를 통합한다
✅ 커스터마이징에 집중한다
```

### 2.2 통합 매핑

| # | 오픈소스 | Stars | v3 패키지 | 통합 방식 |
|---|---------|-------|----------|----------|
| 1 | LightRAG | 36.3k | knowledge-graph | Python 서버 + TS 어댑터 |
| 2 | Mastra | 10k | orchestrator | SDK 직접 사용 |
| 3 | OpenSpace | — | self-evolution | MCP 통합 |
| 4 | Google A2A | 15k | a2a-protocol (신규) | SDK 직접 사용 |
| 5 | AG-UI | 8k | apps/web | 서버/클라이언트 |
| 6 | Hyperagents | — | self-evolution | 논문 기반 구현 |
| 7 | OpenHands | 76k | sandbox (신규) | Docker 패턴 적용 |
| 8 | EvoAgentX | — | benchmark (신규) | 프레임워크 구현 |
| 9 | Karpathy Loop | — | self-evolution | 루프 패턴 적용 |
| 10 | Langfuse | 8k | monitoring (신규) | SDK + Docker |

---

## 3. PR 목록 (10개)

| PR | 오픈소스 | 내용 | 우선순위 | 예상 기간 |
|----|---------|------|---------|----------|
| **PR-01** | Langfuse | 관측성 시스템 | P0 | 3일 |
| **PR-02** | EvoAgentX | 벤치마크 프레임워크 | P0 | 3일 |
| **PR-03** | LightRAG | GraphRAG 재구현 | P0 | 5일 |
| **PR-04** | OpenHands | Docker 격리 샌드박스 | P1 | 4일 |
| **PR-05** | OpenSpace | 스킬 자가 진화 | P1 | 5일 |
| **PR-06** | Mastra | 오케스트레이터 재설계 | P1 | 5일 |
| **PR-07** | Karpathy Loop | 자동 학습 시스템 | P2 | 4일 |
| **PR-08** | AG-UI | 실시간 UI 스트리밍 | P2 | 4일 |
| **PR-09** | Hyperagents | 메타 인지 시스템 | P2 | 4일 |
| **PR-10** | Google A2A | 에이전트 협업 | P2 | 5일 |

---

## 4. 의존성 다이어그램

```
PR-01 (Langfuse) ─────────────────────────────┐
PR-02 (Benchmark) ────────────────────────────┤
                                                │
PR-03 (LightRAG) ── PR-01                      │
                                                │
PR-04 (Sandbox) ─── 독립                        │
                                                │
PR-05 (OpenSpace) ─ PR-03                       │
                                                │
PR-06 (Mastra) ──── PR-01                       │
                                                │
PR-07 (Karpathy) ── PR-05 + PR-04              │
PR-08 (AG-UI) ───── PR-06                       │
PR-09 (Hyperagents) PR-05 + PR-04              │
PR-10 (A2A) ─────── PR-06                       │
```

---

## 5. 주차별 일정

### Phase 1: 기반 구축 (Week 1-2)

| Day | PR | 작업 | 산출물 |
|-----|-----|------|--------|
| Day 1-3 | PR-01 | Langfuse 설치 + 연동 | 모니터링 대시보드 |
| Day 4-6 | PR-02 | 벤치마크 프레임워크 | 11가지 메트릭 |
| Day 7-10 | PR-03 | LightRAG 서버 구축 | 그래프 검색 엔진 |

### Phase 2: 핵심 기능 (Week 3-4)

| Day | PR | 작업 | 산출물 |
|-----|-----|------|--------|
| Day 11-14 | PR-04 | Docker 샌드박스 | 코드 실행 환경 |
| Day 15-19 | PR-05 | OpenSpace 통합 | 스킬 진화 엔진 |

### Phase 3: 워크플로우 (Week 5-6)

| Day | PR | 작업 | 산출물 |
|-----|-----|------|--------|
| Day 20-24 | PR-06 | Mastra 오케스트레이터 | 워크플로우 DSL |
| Day 25-28 | PR-07 | Karpathy Loop | 자동 학습 루프 |

### Phase 4: UI + 에이전트 (Week 7-8)

| Day | PR | 작업 | 산출물 |
|-----|-----|------|--------|
| Day 29-32 | PR-08 | AG-UI 스트리밍 | 실시간 UI |
| Day 33-36 | PR-09 | Hyperagents | 메타 인지 |
| Day 37-41 | PR-10 | A2A 프로토콜 | 에이전트 협업 |

### Phase 5: 통합 + 검증 (Week 9-10)

| Day | 작업 | 산출물 |
|-----|------|--------|
| Day 42-45 | 통합 테스트 | E2E 테스트 |
| Day 46-49 | 부하 테스트 | 성능 리포트 |
| Day 50-53 | 보안 감사 | 보안 리포트 |

### Phase 6: 프로덕션 (Week 11-12)

| Day | 작업 | 산출물 |
|-----|------|--------|
| Day 54-57 | 프로덕션 배포 | 운영 환경 |
| Day 58-61 | 문서화 | 기술 문서 |
| Day 62-65 | 릴리스 | v1.0 릴리스 |

---

## 6. 검증 기준

### 6.1 각 PR별

- [ ] 단위 테스트 통과
- [ ] 기존 기능 회귀 없음
- [ ] 문서 업데이트
- [ ] 코드 리뷰 완료

### 6.2 전체 프로젝트

- [ ] E2E 테스트 80%+ 통과
- [ ] 검색 정확도 84%+
- [ ] 토큰 절감율 46%+
- [ ] 모니터링 100% 커버
- [ ] 프로덕션 배포 가능

---

## 7. 리스크 관리

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 오픈소스 버전 불일치 | 중간 | 높음 | 버전 고정 + 호환성 테스트 |
| LM Studio 성능 병목 | 낮음 | 높음 | 로컬/클라우드 하이브리드 |
| Docker 리소스 부족 | 중간 | 중간 | 메모리 제한 점진적 확대 |
| 학습 데이터 부족 | 높음 | 중간 | 자체 실행 로그 수집 |
| 보안 이슈 | 낮음 | 높음 | 네트워크 차단 + 격리 |

---

## 8. 기대 성과

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| 검색 정확도 | 30% | 84% | +180% |
| 토큰 비용 | 100% | 54% | -46% |
| 테스트 커버리지 | 0% | 80%+ | ∞ |
| 코드 라인 | 6,117줄 | ~12,000줄 | +96% |
| 에이전트 협업 | 3개 | 100+ | +3,233% |
| 모니터링 | 0% | 100% | ∞ |

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
