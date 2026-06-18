# 📋 상세 개발 계획서

> **Version**: 1.0
> **Date**: 2026-06-10
> **Target**: F-aios-v3-core 고도화
> **Duration**: 6개월 (24주)

---

## 1. 개발 목표

### 1.1 최종 목표

```
F-aios-v3-core를 Mock 기반 프로토타입에서
프로덕션 검증된 AI 에이전트 엔진으로 전환
```

### 1.2 측정 지표

| 지표 | 현재 | 3개월 목표 | 6개월 목표 |
|------|------|-----------|-----------|
| 테스트 커버리지 | 0% | 60% | 80%+ |
| GraphRAG 정확도 | 30% | 70% | 84% |
| 토큰 절감율 | 0% | 25% | 46% |
| 프로덕션 배포 | 불가 | 스테이징 | 프로덕션 |
| GitHub Stars | 0 | 50+ | 100+ |

---

## 2. Phase 1: 기반 고도화 (Week 1-4)

### Week 1: 관측성 + 벤치마크 기반 구축

#### PR-10: Langfuse 관측성 시스템

**목적:** 프로덕션 수준의 모니터링 인프라 구축

**작업 범위:**
1. Langfuse 셀프호스팅 Docker 배포
2. `packages/monitoring/` 신규 패키지 생성
3. 오케스트레이터 전 구간 트레이싱
4. 비용 추적 대시보드 구성

**산출물:**
```
packages/monitoring/
├─ src/
│  ├─ langfuse-client.ts      # Langfuse 연결 관리
│  ├─ trace-middleware.ts     # 트레이싱 미들웨어
│  ├─ cost-tracker.ts         # 토큰/비용 추적
│  └─ index.ts
├─ docker-compose.langfuse.yml
├─ package.json
└─ tests/
```

**검증 기준:**
- [ ] 모든 LLM 호출이 트레이싱됨
- [ ] 토큰 사용량이 실시간 표시됨
- [ ] 대시보드에서 비용 확인 가능

**의존성:** 없음 (첫 번째 PR)

---

#### PR-08: EvoAgentX 벤치마크 프레임워크

**목적:** 진화 효과를 측정할 수 있는 벤치마크 시스템 구축

**작업 범위:**
1. `packages/benchmark/` 신규 패키지 생성
2. 성능 메트릭 4개 (성공률, 토큰 효율, 학습 곡선, 스킬 전이율)
3. 진화 메트릭 4개 (스킬 재사용, 개선 속도, 퇴화율, 신규성)
4. 안정성 메트릭 3개 (롤백 빈도, 복구 시간, 일관성)
5. 자동 벤치마크 실행 스크립트

**산출물:**
```
packages/benchmark/
├─ src/
│  ├─ metrics-collector.ts    # 메트릭 수집
│  ├─ evolution-tracker.ts    # 진화 추적
│  ├─ stability-monitor.ts    # 안정성 모니터링
│  ├─ report-generator.ts     # 리포트 생성
│  └─ index.ts
├─ benchmarks/
│  ├─ task-01-search.json     # 검색 벤치마크
│  ├─ task-02-code-gen.json   # 코드 생성 벤치마크
│  └─ task-03-workflow.json   # 워크플로우 벤치마크
├─ package.json
└─ tests/
```

**검증 기준:**
- [ ] 11가지 메트릭 자동 수집
- [ ] 이터레이션별 비교 리포트 생성
- [ ] 회귀 감지 알림 동작

**의존성:** 없음

---

### Week 2: LightRAG 도입

#### PR-01: LightRAG 기반 GraphRAG 재구현

**목적:** 36줄 단순 검색 → 프로덕션 수준 그래프 검색

**작업 범위:**
1. LightRAG Python 서버 구축 (Docker)
2. `packages/knowledge-graph/` 기존 코드 리팩토링
3. LM Studio 임베딩 연동 (nomic-embed-text)
4. 4가지 검색 모드 지원 (local/global/hybrid/mix)
5. 증분 인덱싱 구현

**산출물:**
```
packages/knowledge-graph/
├─ src/
│  ├─ lightrag-adapter.ts     # LightRAG TypeScript 어댑터
│  ├─ embedding-client.ts     # LM Studio 임베딩 클라이언트
│  ├─ graph-store.ts          # 그래프 저장소
│  ├─ query-engine.ts         # 검색 엔진 (4가지 모드)
│  ├─ incremental-indexer.ts  # 증분 인덱싱
│  └─ index.ts
├─ server/
│  └─ lightrag-server.py      # LightRAG Python 서버
├─ docker-compose.lightrag.yml
├─ package.json
└─ tests/
```

**architectural decision:**
```
왜 TypeScript 어댑터 + Python 서버인가?
- LightRAG는 Python 라이브러리 (TypeScript 네이티브 없음)
- Python 서버로 분리하고, TypeScript에서 HTTP로 호출
- LM Studio의 OpenAI 호환 API로 임베딩 전송
```

**검증 기준:**
- [ ] LightRAG 서버 정상 동작 (Docker)
- [ ] LM Studio 임베딩 연동 확인
- [ ] 4가지 검색 모드 동작
- [ ] 증분 인덱싱 동작
- [ ] 기존 v3 테스트와 호환

**의존성:** PR-10 (Langfuse에서 추적)

---

### Week 3: OpenSpace 스킬 진화

#### PR-03: OpenSpace 기반 자기 진화 시스템

**목적:** 시뮬레이션 → 실제 스킬 학습/진화/공유

**작업 범위:**
1. OpenSpace Python 패키지 설치 및 MCP 연동
2. `packages/self-evolution/` 재설계
3. 3가지 진화 모드 구현 (FIX/DERIVED/CAPTURED)
4. SQLite 기반 스킬 저장소
5. 품질 모니터링 대시보드

**산출물:**
```
packages/self-evolution/
├─ src/
│  ├─ skill-store.ts          # SQLite 스킬 저장소
│  ├─ evolution-engine.ts     # 진화 엔진 (3가지 모드)
│  ├─ quality-monitor.ts      # 품질 모니터링
│  ├─ skill-capturer.ts       # 스킬 캡처
│  ├─ openspace-adapter.ts    # OpenSpace MCP 어댑터
│  └─ index.ts
├─ skills/                     # 스킬 디렉토리
├─ package.json
└─ tests/
```

**진화 모드 상세:**
```typescript
// FIX: 실패한 스킬 자동 수정
async fixSkill(skill: Skill, failureReview: string): Promise<Skill> {
  const fixed = await this.llm.generate({
    prompt: `스킬을 수정하세요:\n${skill.content}\n\n실패 원인: ${failureReview}`,
  });
  return { ...skill, content: fixed, version: skill.version + 1 };
}

// DERIVED: 기존 스킬에서 새 스킬 생성
async deriveSkill(parent: Skill, newContext: string): Promise<Skill> {
  const derived = await this.llm.generate({
    prompt: `기존 스킬을 변형하세요:\n${parent.content}\n\n새 맥락: ${newContext}`,
  });
  return { id: uuid(), content: derived, parentId: parent.id, version: 1 };
}

// CAPTURED: 성공 실행에서 스킬 추출
async captureSkill(execution: Execution): Promise<Skill | null> {
  if (execution.reward > 0.8) {
    return { id: uuid(), content: execution.solution, reward: execution.reward };
  }
  return null;
}
```

**검증 기준:**
- [ ] 스킬 저장/조회 동작
- [ ] 3가지 진화 모드 동작
- [ ] 품질 모니터링 동작
- [ ] OpenSpace MCP 연동 확인

**의존성:** PR-01 (LightRAG에서 지식 검색)

---

### Week 4: OpenHands 샌드박스

#### PR-07: OpenHands 패턴 Docker 격리 샌드박스

**목적:** 문자열 매칭 → 실제 코드 실행 환경

**작업 범위:**
1. `packages/sandbox/` 신규 패키지 생성
2. Docker 이미지 빌드 (python-sandbox, node-sandbox)
3. 리소스 제한 (메모리 512MB, CPU 50%, 네트워크 차단)
4. 실행 결과 캡처
5. 타임아웃 관리

**산출물:**
```
packages/sandbox/
├─ src/
│  ├─ docker-executor.ts      # Docker 실행 엔진
│  ├─ sandbox-manager.ts      # 컨테이너 생명주기
│  ├─ resource-limiter.ts     # 리소스 제한
│  ├─ result-capturer.ts      # 결과 캡처
│  └─ index.ts
├─ docker/
│  ├─ python-sandbox/Dockerfile
│  └─ node-sandbox/Dockerfile
├─ package.json
└─ tests/
```

**보안 설정:**
```yaml
# Docker 리소스 제한
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
network_mode: 'none'        # 네트워크 차단
read_only: true              # 읽기 전용 파일시스템
security_opt:
  - no-new-privileges:true   # 권한 상승 차단
```

**검증 기준:**
- [ ] Python 코드 Docker 실행 동작
- [ ] Node.js 코드 Docker 실행 동작
- [ ] 메모리/CPU 제한 동작
- [ ] 네트워크 차단 동작
- [ ] 타임아웃 동작

**의존성:** 없음

---

## 3. Phase 2: 워크플로우 강화 (Week 5-8)

### Week 5: Mastra 오케스트레이터

#### PR-02: Mastra 기반 오케스트레이터 재설계

**목적:** 수동 StateGraph → 선언적 워크플로우 DSL

**작업 범위:**
1. Mastra SDK 설치 및 설정
2. `packages/orchestrator/` 재설계
3. 선언적 워크플로우 DSL 도입
4. 내장 테스트 프레임워크 적용
5. 내장 트레이싱 통합

**산출물:**
```
packages/orchestrator/
├─ src/
│  ├─ workflow-engine.ts      # Mastra 기반 워크플로우
│  ├─ planner-agent.ts        # Planner 에이전트
│  ├─ executor-agent.ts       # Executor 에이전트
│  ├─ critic-agent.ts         # Critic 에이전트
│  ├─ skill-parser.ts         # SKILL.md 파싱 (유지)
│  ├─ task-splitter.ts        # 작업 분할 (유지)
│  └─ index.ts
├─ workflows/
│  ├─ main-workflow.ts        # 메인 워크플로우 정의
│  └─ review-workflow.ts      # 리뷰 워크플로우
├─ package.json
└─ tests/
```

**비교:**
```
현재 (885줄):
  const graphBuilder = new StateGraph<AgentWorkflowState>(stateGraphArgs);
  graphBuilder.addNode('planner', async (state) => { ... });
  graphBuilder.addNode('executor', async (state) => { ... });
  graphBuilder.addNode('critic', async (state) => { ... });
  graphBuilder.addEdge('planner', 'executor');
  graphBuilder.addEdge('executor', 'critic');

Mastra 적용 후 (~350줄):
  const workflow = new Workflow({ name: 'aios-pipeline' })
    .then(plannerStep)
    .then(executorStep)
    .then(criticStep);
```

**검증 기준:**
- [ ] 워크플로우 DSL 동작
- [ ] 기존 기능 100% 호환
- [ ] 테스트 커버리지 80%+
- [ ] Mastra 트레이싱 동작

**의존성:** PR-10 (Langfuse)

---

### Week 6: Karpathy Loop

#### PR-09: Karpathy Loop 자동 학습 시스템

**목적:** HF 데이터셋 의존 → 자체 실행 결과 기반 학습

**작업 범위:**
1. 자동 학습 루프 구현
2. 코드 수정 → 테스트 → 커밋/롤백
3. 야간 자동 실행 스케줄러
4. 이터레이션 리포트 자동 생성

**산출물:**
```
packages/self-evolution/
├─ src/
│  ├─ karpathy-loop.ts        # 자동 학습 루프
│  ├─ code-patcher.ts         # 코드 패치
│  ├─ test-runner.ts          # 자동 테스트
│  ├─ commit-strategy.ts      # 커밋 전략
│  └─ overnight-scheduler.ts  # 야간 스케줄러
```

**검증 기준:**
- [ ] 20회 이터레이션 자동 실행
- [ ] 개선 시 커밋, 미개선 시 롤백
- [ ] 야간 스케줄 동작

**의존성:** PR-03 (OpenSpace), PR-07 (Sandbox)

---

### Week 7: AG-UI

#### PR-05: AG-UI 프로토콜 기반 실시간 UI

**목적:** 폴링 → SSE 스트리밍

**작업 범위:**
1. AG-UI 서버 구현 (Next.js API Route)
2. 에이전트 상태 실시간 스트리밍
3. 도구 실행 시각화
4. CopilotKit 프론트엔드 통합

**산출물:**
```
apps/web/
├─ app/api/agent/
│  └─ stream/route.ts         # AG-UI 스트리밍 엔드포인트
├─ components/
│  ├─ AgentStream.tsx         # 에이전트 스트림 컴포넌트
│  ├─ ToolCallVisualizer.tsx  # 도구 실행 시각화
│  └─ WorkflowStatus.tsx      # 워크플로우 상태
```

**검증 기준:**
- [ ] SSE 스트리밍 동작
- [ ] 에이전트 상태 실시간 표시
- [ ] 도구 실행 시각화 동작

**의존성:** PR-02 (Mastra)

---

### Week 8: Hyperagents

#### PR-06: Hyperagents 메타 인지 시스템

**목적:** 단순 규칙 기반 → 메타 인지 자기 수정

**작업 범위:**
1. Meta Agent 구현 (강한 모델 사용)
2. 자기 프로그램 수정 메커니즘
3. 재귀적 자기 개선 루프
4. 안전 장치 (무한 루프 방지)

**산출물:**
```
packages/self-evolution/
├─ src/
│  ├─ meta-cognitive-agent.ts # 메타 인지 에이전트
│  ├─ self-modifier.ts        # 자기 수정기
│  ├─ safety-guard.ts         # 안전 장치
│  └─ recursive-improver.ts   # 재귀적 개선
```

**검증 기준:**
- [ ] Meta Agent 동작
- [ ] 자기 수정 동작
- [ ] 무한 루프 방지 동작

**의존성:** PR-03 (OpenSpace), PR-07 (Sandbox)

---

## 4. Phase 3: 에이전트 생태계 (Week 9-12)

### Week 9: Google A2A

#### PR-04: Google A2A 프로토콜

**목적:** 독립 에이전트 → 상호운용 에이전트

**작업 범위:**
1. A2A SDK 설치 및 설정
2. `packages/a2a-protocol/` 신규 패키지
3. 에이전트 등록/발现
4. 태스트 위임/협업
5. 보안 토큰 인증

**산출물:**
```
packages/a2a-protocol/
├─ src/
│  ├─ a2a-agent.ts            # A2A 에이전트 정의
│  ├─ a2a-discovery.ts        # 에이전트 발견
│  ├─ a2a-task-manager.ts     # 태스트 관리
│  ├─ a2a-security.ts         # 보안 인증
│  └─ index.ts
```

**검증 기준:**
- [ ] A2A 에이전트 등록 동작
- [ ] 외부 에이전트 발견 동작
- [ ] 태스트 위임 동작

**의존성:** PR-02 (Mastra)

---

### Week 10-12: 통합 테스트 + 프로덕션 검증

**작업 범위:**
1. 전체 통합 테스트
2. 부하 테스트
3. 보안 감사
4. 프로덕션 배포 준비
5. 문서화 완료

**검증 기준:**
- [ ] 전체 E2E 테스트 통과
- [ ] 부하 테스트 통과 (100 동시 사용자)
- [ ] 보안 감사 통과
- [ ] 프로덕션 배포 가능

---

## 5. 의존성 다이어그램

```
Week 1: PR-10 (Langfuse) ←─────────────────────────────┐
         PR-08 (Benchmark) ←────────────────────────────┤
                                                          │
Week 2: PR-01 (LightRAG) ←── PR-10                      │
                                                          │
Week 3: PR-03 (OpenSpace) ←─ PR-01                      │
                                                          │
Week 4: PR-07 (Sandbox) ←─── 독립                        │
                                                          │
Week 5: PR-02 (Mastra) ←──── PR-10                      │
                                                          │
Week 6: PR-09 (Karpathy) ←── PR-03 + PR-07             │
                                                          │
Week 7: PR-05 (AG-UI) ←───── PR-02                      │
                                                          │
Week 8: PR-06 (Hyperagents) ← PR-03 + PR-07            │
                                                          │
Week 9: PR-04 (A2A) ←─────── PR-02                      │
                                                          │
Week 10-12: 통합 테스트 ←──── 전부                        │
```

---

## 6. 리소스 요구사항

### 6.1 개발 환경

| 항목 | 요구사항 |
|------|---------|
| Node.js | 22 LTS |
| pnpm | 10+ |
| Docker | Desktop |
| LM Studio | localhost:1234 |
| RAM | 16GB+ (Docker용 8GB) |
| 디스크 | 50GB+ |

### 6.2 프로덕션 환경

| 항목 | 요구사항 |
|------|---------|
| 서버 | 2코어 8GB+ |
| Docker | 24GB 메모리 할당 |
| SSD | 100GB+ |
| 네트워크 | 100Mbps+ |

---

## 7. 검증 체크리스트

### PR별 검증

- [ ] 모든 PR이 독립적으로 빌드/테스트 가능
- [ ] 기존 기능 100% 호환
- [ ] 문서 업데이트
- [ ] 코드 리뷰 완료

### 프로덕션 검증

- [ ] E2E 테스트 통과
- [ ] 부하 테스트 통과
- [ ] 보안 감사 통과
- [ ] 모니터링 동작 확인
- [ ] 롤백 계획 수립

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
