# 📝 PR #2: Mastra 기반 오케스트레이터 재설계

> **Branch**: `feature/mastra-orchestrator`
> **Priority**: P1
> **Duration**: 1주
> **의존성**: PR-10 (Langfuse)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 885줄 수동 StateGraph → ~350줄 선언적 워크플로우 DSL |
| **오픈소스** | [Mastra](https://github.com/mastra-ai/mastra) (⭐ 10k+, TypeScript 네이티브) |
| **영향 패키지** | `packages/orchestrator/` |
| **예상 코드 변화** | 1,321줄 → ~800줄 (40% 감소) |

---

## 2. 기술 설계

### 2.1 비교

```
현재 (885줄):
  const graphBuilder = new StateGraph<AgentWorkflowState>(stateGraphArgs);
  graphBuilder.addNode('planner', async (state) => { ... });
  graphBuilder.addNode('executor', async (state) => { ... });
  graphBuilder.addNode('critic', async (state) => { ... });
  graphBuilder.addEdge('planner', 'executor');
  graphBuilder.addEdge('executor', 'critic');
  // 수동 상태 관리, 수동 에러 핸들링

Mastra 적용 후 (~350줄):
  const workflow = new Workflow({ name: 'aios-pipeline' })
    .then(plannerStep)
    .then(executorStep)
    .then(criticStep);
  // 선언적 정의, 자동 상태 관리, 내장 트레이싱
```

### 2.2 핵심 이점

| 이점 | 현재 | Mastra |
|------|------|--------|
| 코드 라인 | 885줄 | ~350줄 |
| 테스트 | 0개 | 내장 프레임워크 |
| 트레이싱 | console.log | 내장 |
| 에러 핸들링 | 수동 | 자동 |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/orchestrator/
├─ src/
│  ├─ workflow-engine.ts      # ★ Mastra 기반 워크플로우 엔진
│  ├─ planner-agent.ts        # ★ 수정: Mastra Agent로 재설계
│  ├─ executor-agent.ts       # ★ 수정: Mastra Agent로 재설계
│  ├─ critic-agent.ts         # ★ 수정: Mastra Agent로 재설계
│  ├─ skill-parser.ts         # 유지
│  ├─ task-splitter.ts        # 유지
│  ├─ orchestrator.ts         # 삭제 (workflow-engine.ts로 대체)
│  └─ index.ts                # 수정
├─ workflows/
│  ├─ main-workflow.ts        # ★ 신규: 메인 워크플로우 정의
│  └─ review-workflow.ts      # ★ 신규: 리뷰 워크플로우
├─ package.json               # 수정: @mastra/core 추가
└─ tests/
   ├─ workflow-engine.test.ts # ★ 신규
   └─ agents.test.ts          # ★ 신규
```

### 3.2 핵심 구현 코드

#### workflow-engine.ts

```typescript
import { Agent, Workflow, Step } from '@mastra/core';
import { RapidMLXClient } from '@aios/ai-core';

export class WorkflowEngine {
  private workflow: Workflow;

  constructor(private client: RapidMLXClient) {
    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow(): Workflow {
    const plannerStep = new Step({
      id: 'planner',
      execute: async ({ context }) => {
        const { taskInput, projectContext, review } = context;
        const plan = await this.client.chatCompletion({
          model: 'qwen3.5-9b',
          messages: [
            { role: 'system', content: 'You are the Planner agent.' },
            { role: 'user', content: `Task: ${taskInput}\nContext: ${JSON.stringify(projectContext)}${review ? `\nReview: ${review}` : ''}` },
          ],
        });
        return { plan: plan.choices[0].message.content };
      },
    });

    const executorStep = new Step({
      id: 'executor',
      execute: async ({ context }) => {
        const { plan, mcpRegistry } = context;
        const result = await this.client.chatCompletion({
          model: 'qwen3.5-9b',
          messages: [
            { role: 'system', content: 'You are the Executor agent.' },
            { role: 'user', content: `Execute this plan:\n${plan}` },
          ],
        });
        return { executionResult: result.choices[0].message.content };
      },
    });

    const criticStep = new Step({
      id: 'critic',
      execute: async ({ context }) => {
        const { plan, executionResult } = context;
        const review = await this.client.chatCompletion({
          model: 'qwen3.5-9b',
          messages: [
            { role: 'system', content: 'You are the Critic agent. Start with VERDICT: APPROVED | NEEDS_CORRECTION' },
            { role: 'user', content: `Plan:\n${plan}\n\nResult:\n${executionResult}` },
          ],
        });
        return { review: review.choices[0].message.content };
      },
    });

    return new Workflow({ name: 'aios-pipeline' })
      .then(plannerStep)
      .then(executorStep)
      .then(criticStep);
  }

  async run(input: { taskInput: string; projectContext?: any }) {
    return await this.workflow.execute(input);
  }
}
```

---

## 4. 테스트 계획

```typescript
// workflow-engine.test.ts
describe('WorkflowEngine', () => {
  it('should execute planner → executor → critic pipeline', async () => {
    const engine = new WorkflowEngine(mockClient);
    const result = await engine.run({ taskInput: '테스트 작업' });
    expect(result.plan).toBeTruthy();
    expect(result.executionResult).toBeTruthy();
    expect(result.review).toContain('VERDICT');
  });
});
```

---

## 5. 검증 체크리스트

- [ ] Mastra SDK 설치 및 동작
- [ ] 워크플로우 DSL 동작
- [ ] 기존 기능 100% 호환
- [ ] 테스트 커버리지 80%+
- [ ] Langfuse 트레이싱 동작
- [ ] 코드 리뷰 완료

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
