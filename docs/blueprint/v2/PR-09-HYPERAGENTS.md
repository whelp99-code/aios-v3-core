# 📝 PR-09: Hyperagents 메타 인지 시스템

> **Branch**: `feature/pr-09-hyperagents`
> **Priority**: P2
> **Duration**: 4일
> **의존성**: PR-05 (OpenSpace), PR-04 (Sandbox)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 단순 규칙 기반 → 메타 인지 자기 수정 |
| **오픈소스** | Hyperagents 논문 기반 |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드** | ~500줄 추가 |

---

## 2. 메타 인지 구조

```
현재 v3:
  if (successRate < threshold) → threshold -= 0.03

Hyperagents:
  Task Agent (작업 수행)
       ↕
  Meta Agent (자기 성찰 → 자체 프로그램 수정)
       ↕
  Self-Modification Mechanism 자체가 진화
```

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/self-evolution/
├─ src/
│  ├─ meta-cognitive-agent.ts # 메타 인지 에이전트
│  ├─ self-modifier.ts        # 자기 수정기
│  ├─ safety-guard.ts         # 안전 장치
│  └─ recursive-improver.ts   # 재귀적 개선
```

### 3.2 핵심 구현

#### meta-cognitive-agent.ts

```typescript
import { RapidMLXClient } from '@aios/ai-core';

export interface Reflection {
  analysis: string;
  rootCause: string;
  improvementProposal: string;
  codePatch?: string;
  confidenceScore: number;
}

export interface MetaContext {
  taskInput: string;
  executionResult: string;
  successRate: number;
  recentFailures: string[];
  currentCode: string;
}

export class MetaCognitiveAgent {
  private iterationCount: number = 0;
  private maxIterations: number = 10;

  constructor(private llm: RapidMLXClient) {}

  # 메타 성찰
  async reflect(context: MetaContext): Promise<Reflection> {
    this.iterationCount++;

    const reflectionPrompt = this.buildReflectionPrompt(context);

    const result = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `당신은 메타 인지 에이전트입니다.
자신의 프로세스를 성찰하고 개선안을 제시하세요.

분석 형식:
1. 분석: 현재 상황 분석
2. 근본 원인: 실패의 근본 원인
3. 개선 제안: 구체적인 개선 방안
4. 코드 패치: 수정이 필요한 코드 (선택)
5. 신뢰도: 0-1 사이의 신뢰도 점수`
        },
        {
          role: 'user',
          content: reflectionPrompt
        },
      ],
    });

    return this.parseReflection(result.choices[0].message.content);
  }

  # 자기 수정
  async selfModify(reflection: Reflection): Promise<string | null> {
    if (!reflection.codePatch) return null;

    const result = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `코드 패치를 검증하고 적용 가능한 형태로 변환하세요.
안전하지 않은 코드는 수정하세요.`
        },
        {
          role: 'user',
          content: `패치:
${reflection.codePatch}

검증 및 적용:`
        },
      ],
    });

    return result.choices[0].message.content;
  }

  # 재귀적 개선
  async recursiveImprove(
    currentCode: string,
    context: MetaContext,
    depth: number = 0
  ): Promise<{
    improvedCode: string;
    totalReflections: number;
    improvements: string[];
  }> {
    if (depth >= this.maxIterations) {
      return { improvedCode: currentCode, totalReflections: depth, improvements: [] };
    }

    # 메타 성찰
    const reflection = await this.reflect({
      ...context,
      currentCode,
    });

    # 신뢰도가 낮으면 중단
    if (reflection.confidenceScore < 0.3) {
      return { improvedCode: currentCode, totalReflections: depth, improvements: [] };
    }

    # 자기 수정
    const patch = await this.selfModify(reflection);
    if (!patch) {
      return { improvedCode: currentCode, totalReflections: depth, improvements: [] };
    }

    # 패치 적용
    const improvedCode = this.applyPatch(currentCode, patch);

    # 재귀적 개선
    const result = await this.recursiveImprove(improvedCode, context, depth + 1);

    return {
      improvedCode: result.improvedCode,
      totalReflections: result.totalReflections + 1,
      improvements: [reflection.improvementProposal, ...result.improvements],
    };
  }

  private buildReflectionPrompt(context: MetaContext): string {
    return `
현재 작업: ${context.taskInput}

실행 결과: ${context.executionResult}

성공률: ${(context.successRate * 100).toFixed(1)}%

최근 실패 사례:
${context.recentFailures.length > 0
  ? context.recentFailures.map(f => `- ${f}`).join('\n')
  : '없음'
}

현재 코드:
${context.currentCode}

위 정보를 바탕으로 자기 프로세스를 성찰하고 개선안을 제시하세요.
`;
  }

  private parseReflection(text: string): Reflection {
    # 간이 파싱 (실제로는 더 정교한 파싱 필요)
    const lines = text.split('\n');
    let analysis = '';
    let rootCause = '';
    let improvementProposal = '';
    let codePatch: string | undefined;
    let confidenceScore = 0.5;

    let currentSection = '';

    for (const line of lines) {
      if (line.includes('분석:')) currentSection = 'analysis';
      else if (line.includes('근본 원인:')) currentSection = 'rootCause';
      else if (line.includes('개선 제안:')) currentSection = 'improvement';
      else if (line.includes('코드 패치:')) currentSection = 'patch';
      else if (line.includes('신뢰도:')) {
        const match = line.match(/[\d.]+/);
        if (match) confidenceScore = parseFloat(match[0]);
      }

      switch (currentSection) {
        case 'analysis': analysis += line + '\n'; break;
        case 'rootCause': rootCause += line + '\n'; break;
        case 'improvement': improvementProposal += line + '\n'; break;
        case 'patch': codePatch = (codePatch || '') + line + '\n'; break;
      }
    }

    return {
      analysis: analysis.trim(),
      rootCause: rootCause.trim(),
      improvementProposal: improvementProposal.trim(),
      codePatch: codePatch?.trim(),
      confidenceScore,
    };
  }

  private applyPatch(currentCode: string, patch: string): string {
    # 패치가 전체 코드를 포함하는 경우
    if (patch.includes('def ') || patch.includes('function ') || patch.includes('class ')) {
      return patch;
    }
    # 패치가 부분적인 경우
    return currentCode + '\n' + patch;
  }
}
```

#### safety-guard.ts

```typescript
export class SafetyGuard {
  private iterationCount: number = 0;
  private maxIterations: number;
  private cooldownPeriod: number;
  private lastImprovementTime: Date | null = null;

  constructor(config: {
    maxIterations?: number;
    cooldownPeriod?: number;
  } = {}) {
    this.maxIterations = config.maxIterations ?? 10;
    this.cooldownPeriod = config.cooldownPeriod ?? 60000; # 1분
  }

  # 진행 가능 여부 확인
  canProceed(): boolean {
    if (this.iterationCount >= this.maxIterations) {
      console.warn('[SafetyGuard] 최대 이터레이션 도달');
      return false;
    }

    if (this.lastImprovementTime) {
      const elapsed = Date.now() - this.lastImprovementTime.getTime();
      if (elapsed < this.cooldownPeriod) {
        console.warn(`[SafetyGuard] 쿨다운 중 (${Math.ceil((this.cooldownPeriod - elapsed) / 1000)}초 남음)`);
        return false;
      }
    }

    return true;
  }

  # 이터레이션 기록
  recordIteration(improved: boolean): void {
    this.iterationCount++;

    if (improved) {
      this.lastImprovementTime = new Date();
    }
  }

  # 카운트 초기화
  reset(): void {
    this.iterationCount = 0;
    this.lastImprovementTime = null;
  }

  # 상태 조회
  getStatus(): {
    iterationCount: number;
    maxIterations: number;
    canProceed: boolean;
    lastImprovement: Date | null;
  } {
    return {
      iterationCount: this.iterationCount,
      maxIterations: this.maxIterations,
      canProceed: this.canProceed(),
      lastImprovement: this.lastImprovementTime,
    };
  }
}
```

---

## 4. 테스트 계획

```typescript
describe('MetaCognitiveAgent', () => {
  it('should perform reflection', async () => {
    const agent = new MetaCognitiveAgent(mockLLM);
    const reflection = await agent.reflect(mockContext);
    expect(reflection.analysis).toBeTruthy();
    expect(reflection.confidenceScore).toBeGreaterThan(0);
  });
});

describe('SafetyGuard', () => {
  it('should block after max iterations', () => {
    const guard = new SafetyGuard({ maxIterations: 3 });
    guard.recordIteration(true);
    guard.recordIteration(true);
    guard.recordIteration(true);
    expect(guard.canProceed()).toBe(false);
  });
});
```

---

## 5. 검증 체크리스트

- [ ] Meta Agent 동작
- [ ] 자기 수정 동작
- [ ] 재귀적 개선 동작
- [ ] 무한 루프 방지 동작
- [ ] 안전 가드 동작
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
