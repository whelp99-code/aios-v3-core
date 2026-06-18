# 📝 PR-07: Karpathy Loop 자동 학습 시스템

> **Branch**: `feature/pr-07-karpathy`
> **Priority**: P2
> **Duration**: 4일
> **의존성**: PR-05 (OpenSpace), PR-04 (Sandbox)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | HF 데이터셋 의존 → 자체 실행 결과 기반 학습 |
| **오픈소스** | Karpathy/AutoResearch Loop 패턴 |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드** | ~500줄 추가 |

---

## 2. Karpathy Loop 흐름

```
1. 현재 코드 분석
2. 개선 제안 생성 (LLM)
3. 패치 생성 및 적용
4. 테스트 실행 (Sandbox)
5. 결과 평가
6. 개선 시 커밋 / 미개선 시 롤백
7. 반복 (최대 20회)
```

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/self-evolution/
├─ src/
│  ├─ karpathy-loop.ts        # 자동 학습 루프
│  ├─ code-patcher.ts         # 코드 패치
│  ├─ test-runner.ts          # 자동 테스트
│  ├─ commit-strategy.ts      # 커밋 전략
│  └─ overnight-scheduler.ts  # 야간 스케줄러
```

### 3.2 핵심 구현

#### karpathy-loop.ts

```typescript
import { RapidMLXClient } from '@aios/ai-core';
import { SandboxManager } from '@aios/sandbox';
import { SkillStore } from './skill-store';

export interface LoopIteration {
  iteration: number;
  proposal: string;
  patch?: string;
  testResult: { success: boolean; output: string };
  committed: boolean;
  improvement: number;
}

export interface LoopReport {
  totalIterations: number;
  committedCount: number;
  rolledBackCount: number;
  totalImprovement: number;
  iterations: LoopIteration[];
}

export class KarpathyLoop {
  private maxIterations: number = 20;
  private improvementThreshold: number = 0.05;

  constructor(
    private llm: RapidMLXClient,
    private sandbox: SandboxManager,
    private skillStore: SkillStore
  ) {}

  # 자동 학습 루프 실행
  async run(currentCode: string): Promise<LoopReport> {
    const iterations: LoopIteration[] = [];
    let previousCode = currentCode;
    let totalImprovement = 0;

    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[Karpathy Loop] 이터레이션 ${i + 1}/${this.maxIterations}`);

      # 1. 개선 제안 생성
      const proposal = await this.generateProposal(previousCode, iterations);
      console.log(`  제안: ${proposal.slice(0, 100)}...`);

      # 2. 패치 생성
      const patch = await this.generatePatch(previousCode, proposal);

      # 3. 패치 적용
      const patchedCode = this.applyPatch(previousCode, patch);

      # 4. 테스트 실행
      const testResult = await this.runTest(patchedCode);
      console.log(`  테스트: ${testResult.success ? '성공' : '실패'}`);

      # 5. 결과 평가
      const improvement = this.evaluateImprovement(
        previousCode,
        patchedCode,
        testResult
      );

      const committed = improvement > this.improvementThreshold;

      if (committed) {
        previousCode = patchedCode;
        totalImprovement += improvement;
        console.log(`  커밋 (${improvement.toFixed(3)} 향상)`);
      } else {
        console.log(`  롤백 (향상 없음)`);
      }

      iterations.push({
        iteration: i,
        proposal,
        patch,
        testResult,
        committed,
        improvement,
      });

      # 6. 성공 시 스킬로 캡처
      if (committed && testResult.success) {
        await this.skillStore.save({
          name: `auto-learned-${i}`,
          content: proposal,
          version: 1,
          reward: improvement,
          usageCount: 1,
          successRate: 1,
          metadata: { source: 'karpathy-loop', iteration: i },
        });
      }
    }

    return {
      totalIterations: iterations.length,
      committedCount: iterations.filter(i => i.committed).length,
      rolledBackCount: iterations.filter(i => !i.committed).length,
      totalImprovement,
      iterations,
    };
  }

  # 개선 제안 생성
  private async generateProposal(
    currentCode: string,
    previousIterations: LoopIteration[]
  ): Promise<string> {
    const recentFailures = previousIterations
      .filter(i => !i.committed)
      .slice(-3)
      .map(i => `- ${i.proposal}`)
      .join('\n');

    const result = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `코드 개선 전문가입니다.
현재 코드를 분석하고 개선안을 제시하세요.
이전 실패 사례를 참고하여 반복적인 실패를 피하세요.`
        },
        {
          role: 'user',
          content: `현재 코드:
${currentCode}

${recentFailures ? `이전 실패 사례:
${recentFailures}` : ''}

개선안:`
        },
      ],
    });

    return result.choices[0].message.content;
  }

  # 패치 생성
  private async generatePatch(
    currentCode: string,
    proposal: string
  ): Promise<string> {
    const result = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `코드 패치를 생성하세요.
 unified diff 형식이 아닌, 전체 수정된 코드를 반환하세요.`
        },
        {
          role: 'user',
          content: `현재 코드:
${currentCode}

개선안:
${proposal}

수정된 코드:`
        },
      ],
    });

    return result.choices[0].message.content;
  }

  # 패치 적용
  private applyPatch(currentCode: string, patch: string): string {
    # LLM이 반환한 전체 코드 사용
    return patch;
  }

  # 테스트 실행
  private async runTest(code: string): Promise<{
    success: boolean;
    output: string;
  }> {
    try {
      const result = await this.sandbox.runCode('python', code, { timeout: 10000 });
      return {
        success: result.success,
        output: result.stdout || result.stderr,
      };
    } catch (error) {
      return {
        success: false,
        output: String(error),
      };
    }
  }

  # 개선도 평가
  private evaluateImprovement(
    previousCode: string,
    newCode: string,
    testResult: { success: boolean; output: string }
  ): number {
    if (!testResult.success) return 0;

    # 코드 길이 비교 (간이 평가)
    const lengthRatio = previousCode.length / newCode.length;
    const improvement = (lengthRatio - 1) * 0.5;

    # 성공 보너스
    const successBonus = testResult.success ? 0.1 : 0;

    return improvement + successBonus;
  }
}
```

#### overnight-scheduler.ts

```typescript
import { KarpathyLoop } from './karpathy-loop';

export interface ScheduleConfig {
  enabled: boolean;
  startTime: string;      # HH:mm
  maxIterations: number;
  cooldownMinutes: number;
}

export class OvernightScheduler {
  private loop: KarpathyLoop;
  private config: ScheduleConfig;
  private timer: NodeJS.Timeout | null = null;

  constructor(loop: KarpathyLoop, config: Partial<ScheduleConfig> = {}) {
    this.loop = loop;
    this.config = {
      enabled: config.enabled ?? true,
      startTime: config.startTime ?? '02:00',
      maxIterations: config.maxIterations ?? 20,
      cooldownMinutes: config.cooldownMinutes ?? 60,
    };
  }

  # 스케줄 시작
  start(currentCode: string): void {
    if (!this.config.enabled) return;

    const now = new Date();
    const [hours, minutes] = this.config.startTime.split(':').map(Number);

    const targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);

    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const delay = targetTime.getTime() - now.getTime();

    console.log(`[Overnight Scheduler] ${this.config.startTime}에 실행 예정`);

    this.timer = setTimeout(async () => {
      console.log('[Overnight Scheduler] 야간 학습 시작');
      const report = await this.loop.run(currentCode);
      console.log(`[Overnight Scheduler] 완료: ${report.committedCount}회 커밋`);
    }, delay);
  }

  # 스케줄 중지
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  # 즉시 실행
  async runNow(currentCode: string): Promise<void> {
    console.log('[Overnight Scheduler] 즉시 실행');
    const report = await this.loop.run(currentCode);
    console.log(`[Overnight Scheduler] 완료: ${report.committedCount}회 커밋`);
  }
}
```

---

## 4. 테스트 계획

```typescript
describe('KarpathyLoop', () => {
  it('should run iterations and generate report', async () => {
    const loop = new KarpathyLoop(mockLLM, mockSandbox, mockStore);
    const report = await loop.run('print("hello")');

    expect(report.totalIterations).toBeGreaterThan(0);
    expect(report.iterations).toBeDefined();
  });
});
```

---

## 5. 검증 체크리스트

- [ ] 20회 이터레이션 자동 실행
- [ ] 개선 시 커밋, 미개선 시 롤백
- [ ] 야간 스케줄 동작
- [ ] 스킬 캡처 동작
- [ ] 리포트 자동 생성

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
