# 📝 PR-06: Mastra 기반 오케스트레이터 재설계

> **Branch**: `feature/pr-06-mastra`
> **Priority**: P1
> **Duration**: 5일
> **의존성**: PR-01 (Langfuse)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 885줄 수동 StateGraph → ~400줄 선언적 워크플로우 DSL |
| **오픈소스** | [Mastra](https://github.com/mastra-ai/mastra) (⭐ 10k+, TypeScript 네이티브) |
| **영향 패키지** | `packages/orchestrator/` |
| **예상 코드** | 1,321줄 → ~800줄 (40% 감소) |

---

## 2. 비교

```
현재 (885줄):
  const graphBuilder = new StateGraph<AgentWorkflowState>(stateGraphArgs);
  graphBuilder.addNode('planner', async (state) => { ... });
  graphBuilder.addNode('executor', async (state) => { ... });
  graphBuilder.addNode('critic', async (state) => { ... });
  graphBuilder.addEdge('planner', 'executor');
  graphBuilder.addEdge('executor', 'critic');

Mastra 적용 후 (~400줄):
  const workflow = new Workflow({ name: 'aios-pipeline' })
    .then(plannerStep)
    .then(executorStep)
    .then(criticStep);
```

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/orchestrator/
├─ src/
│  ├─ workflow-engine.ts      # ★ Mastra 기반 워크플로우
│  ├─ planner-agent.ts        # ★ 수정: Mastra Agent
│  ├─ executor-agent.ts       # ★ 수정: Mastra Agent
│  ├─ critic-agent.ts         # ★ 수정: Mastra Agent
│  ├─ skill-parser.ts         # 유지
│  ├─ task-splitter.ts        # 유지
│  └─ index.ts
├─ workflows/
│  ├─ main-workflow.ts        # ★ 메인 워크플로우
│  └─ review-workflow.ts      # ★ 리뷰 워크플로우
├─ package.json
└─ tests/
```

### 3.2 핵심 구현

#### workflow-engine.ts

```typescript
import { Agent, Workflow, Step } from '@mastra/core';
import { RapidMLXClient } from '@aios/ai-core';

export interface WorkflowContext {
  taskInput: string;
  projectContext?: any;
  plan?: string;
  executionResult?: string;
  review?: string;
}

export class WorkflowEngine {
  private client: RapidMLXClient;

  constructor(client: RapidMLXClient) {
    this.client = client;
  }

  # 워크플로우 실행
  async run(input: { taskInput: string; projectContext?: any }): Promise<{
    plan: string;
    executionResult: string;
    review: string;
    verdict: 'APPROVED' | 'NEEDS_CORRECTION';
  }> {
    const plannerStep = new Step({
      id: 'planner',
      execute: async ({ context }) => {
        const { taskInput, projectContext } = context;
        const plan = await this.client.chatCompletion({
          model: 'qwen3.5-9b',
          messages: [
            {
              role: 'system',
              content: `당신은 Planner 에이전트입니다.
작업을 분석하고 실행 가능한 계획을 수립하세요.
계획은 다음 형식을 따라야 합니다:
1. 목표
2. 필요한 도구
3. 단계별 절차
4. 예상 결과`
            },
            {
              role: 'user',
              content: `작업: ${taskInput}
${projectContext ? `프로젝트 컨텍스트: ${JSON.stringify(projectContext)}` : ''}`
            },
          ],
        });
        return { plan: plan.choices[0].message.content };
      },
    });

    const executorStep = new Step({
      id: 'executor',
      execute: async ({ context }) => {
        const { plan } = context;
        const result = await this.client.chatCompletion({
          model: 'qwen3.5-9b',
          messages: [
            {
              role: 'system',
              content: `당신은 Executor 에이전트입니다.
계획에 따라 작업을 실행하세요.
각 단계의 결과를 기록하세요.`
            },
            {
              role: 'user',
              content: `계획:
${plan}

실행 결과를 작성하세요:`
            },
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
            {
              role: 'system',
              content: `당신은 Critic 에이전트입니다.
실행 결과를 검토하고 판정하세요.
반드시 다음 형식으로 시작하세요:
VERDICT: APPROVED | NEEDS_CORRECTION`
            },
            {
              role: 'user',
              content: `계획:
${plan}

실행 결과:
${executionResult}

검토 결과:`
            },
          ],
        });

        const verdictText = review.choices[0].message.content;
        const verdict = verdictText.includes('APPROVED')
          ? 'APPROVED'
          : 'NEEDS_CORRECTION';

        return { review: verdictText, verdict };
      },
    });

    const workflow = new Workflow({ name: 'aios-pipeline' })
      .then(plannerStep)
      .then(executorStep)
      .then(criticStep);

    const result = await workflow.execute(input);

    return {
      plan: result.plan,
      executionResult: result.executionResult,
      review: result.review,
      verdict: result.verdict,
    };
  }

  # 단일 에이전트 실행
  async runSingleAgent(
    agentType: 'planner' | 'executor' | 'critic',
    input: string
  ): Promise<string> {
    const systemPrompts = {
      planner: '당신은 Planner 에이전트입니다. 작업을 분석하고 계획을 수립하세요.',
      executor: '당신은 Executor 에이전트입니다. 계획에 따라 작업을 실행하세요.',
      critic: '당신은 Critic 에이전트입니다. 결과를 검토하고 판정하세요.',
    };

    const result = await this.client.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        { role: 'system', content: systemPrompts[agentType] },
        { role: 'user', content: input },
      ],
    });

    return result.choices[0].message.content;
  }
}
```

---

## 4. 테스트 계획

```typescript
describe('WorkflowEngine', () => {
  it('should execute planner → executor → critic pipeline', async () => {
    const engine = new WorkflowEngine(mockClient);
    const result = await engine.run({ taskInput: '테스트 작업' });

    expect(result.plan).toBeTruthy();
    expect(result.executionResult).toBeTruthy();
    expect(result.review).toContain('VERDICT');
    expect(['APPROVED', 'NEEDS_CORRECTION']).toContain(result.verdict);
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
