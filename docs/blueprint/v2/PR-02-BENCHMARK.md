# 📝 PR-02: EvoAgentX 벤치마크 프레임워크

> **Branch**: `feature/pr-02-benchmark`
> **Priority**: P0
> **Duration**: 3일
> **의존성**: 없음

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 진화 효과를 측정할 수 있는 벤치마크 시스템 구축 |
| **오픈소스** | EvoAgentX Self-Evolving Agents Survey |
| **영향 패키지** | `packages/benchmark/` (신규) |
| **예상 코드** | 신규 ~700줄 |

---

## 2. 벤치마크 메트릭 (11개)

### 2.1 성능 메트릭 (4개)

| 메트릭 | 설명 | 공식 |
|--------|------|------|
| **Success Rate** | 작업 성공률 | 성공/전체 × 100 |
| **Token Efficiency** | 토큰당 성과 | 결과 점수/토큰 × 1000 |
| **Learning Curve** | 학습 곡선 | 이터레이션별 성공률 변화 |
| **Transfer Rate** | 스킬 전이율 | 새 작업 적용 성공률 |

### 2.2 진화 메트릭 (4개)

| 메트릭 | 설명 | 공식 |
|--------|------|------|
| **Skill Reuse Rate** | 스킬 재사용률 | 재사용/전체 스킬 × 100 |
| **Improvement Rate** | 개선 속도 | (이터레이션 N 성과 - N-1 성과) |
| **Regression Rate** | 퇴화율 | 성능 저하 이터레이션/전체 |
| **Novelty Score** | 신규 해결책 비율 | 새 방법 사용/전체 × 100 |

### 2.3 안정성 메트릭 (3개)

| 메트릭 | 설명 | 공식 |
|--------|------|------|
| **Rollback Rate** | 롤백 빈도 | 롤백/전체 실행 × 100 |
| **Recovery Time** | 복구 시간 | 실패 → 복구 평균 시간 |
| **Consistency Score** | 일관성 점수 | 동일 입력 동일 결과율 |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/benchmark/
├─ src/
│  ├─ benchmark-suite.ts      # 벤치마크 실행 엔진
│  ├─ metrics-collector.ts    # 메트릭 수집
│  ├─ evolution-tracker.ts    # 진화 추적
│  ├─ stability-monitor.ts    # 안정성 모니터링
│  ├─ report-generator.ts     # 리포트 생성
│  └─ index.ts
├─ tasks/
│  ├─ task-01-search.json     # 검색 벤치마크
│  ├─ task-02-code-gen.json   # 코드 생성 벤치마크
│  ├─ task-03-workflow.json   # 워크플로우 벤치마크
│  └─ task-04-review.json     # 리뷰 벤치마크
├─ package.json
└─ tests/
   ├─ benchmark-suite.test.ts
   ├─ metrics-collector.test.ts
   └─ report-generator.test.ts
```

### 3.2 핵심 구현

#### benchmark-suite.ts

```typescript
export interface Task {
  id: string;
  name: string;
  description: string;
  input: any;
  expectedOutput?: any;
  timeout?: number;
}

export interface BenchmarkResult {
  iteration: number;
  taskId: string;
  success: boolean;
  tokensUsed: number;
  durationMs: number;
  output: any;
  score: number;        # 0-1 사이 점수
  skillReused: boolean;
  timestamp: Date;
}

export interface BenchmarkReport {
  metadata: {
    totalIterations: number;
    totalTasks: number;
    startTime: Date;
    endTime: Date;
    durationMs: number;
  };
  performance: {
    successRate: number;
    tokenEfficiency: number;
    learningCurve: number[];
    transferRate: number;
  };
  evolution: {
    skillReuseRate: number;
    improvementRate: number;
    regressionRate: number;
    noveltyScore: number;
  };
  stability: {
    rollbackRate: number;
    recoveryTimeMs: number;
    consistencyScore: number;
  };
  results: BenchmarkResult[];
}

export class BenchmarkSuite {
  private results: BenchmarkResult[] = [];
  private taskExecutor: (task: Task) => Promise<BenchmarkResult>;

  constructor(
    taskExecutor: (task: Task) => Promise<BenchmarkResult>
  ) {
    this.taskExecutor = taskExecutor;
  }

  async runBenchmark(
    tasks: Task[],
    iterations: number = 10
  ): Promise<BenchmarkReport> {
    const startTime = new Date();

    for (let i = 0; i < iterations; i++) {
      for (const task of tasks) {
        const result = await this.taskExecutor(task);
        result.iteration = i;
        this.results.push(result);
      }
    }

    const endTime = new Date();

    return this.generateReport(startTime, endTime);
  }

  private generateReport(startTime: Date, endTime: Date): BenchmarkReport {
    return {
      metadata: {
        totalIterations: this.results.length > 0
          ? Math.max(...this.results.map(r => r.iteration)) + 1
          : 0,
        totalTasks: new Set(this.results.map(r => r.taskId)).size,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      },
      performance: {
        successRate: this.calcSuccessRate(),
        tokenEfficiency: this.calcTokenEfficiency(),
        learningCurve: this.calcLearningCurve(),
        transferRate: this.calcTransferRate(),
      },
      evolution: {
        skillReuseRate: this.calcSkillReuse(),
        improvementRate: this.calcImprovement(),
        regressionRate: this.calcRegression(),
        noveltyScore: this.calcNovelty(),
      },
      stability: {
        rollbackRate: this.calcRollback(),
        recoveryTimeMs: this.calcRecoveryTime(),
        consistencyScore: this.calcConsistency(),
      },
      results: this.results,
    };
  }

  # 성능 메트릭 계산
  private calcSuccessRate(): number {
    if (this.results.length === 0) return 0;
    const successCount = this.results.filter(r => r.success).length;
    return (successCount / this.results.length) * 100;
  }

  private calcTokenEfficiency(): number {
    if (this.results.length === 0) return 0;
    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const totalTokens = this.results.reduce((sum, r) => sum + r.tokensUsed, 0);
    return totalTokens > 0 ? (totalScore / totalTokens) * 1000 : 0;
  }

  private calcLearningCurve(): number[] {
    const iterations = Math.max(...this.results.map(r => r.iteration)) + 1;
    const curve: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const iterResults = this.results.filter(r => r.iteration === i);
      const successRate = iterResults.length > 0
        ? iterResults.filter(r => r.success).length / iterResults.length * 100
        : 0;
      curve.push(successRate);
    }

    return curve;
  }

  private calcTransferRate(): number {
    const taskIds = [...new Set(this.results.map(r => r.taskId))];
    if (taskIds.length <= 1) return 0;

    let transferredCount = 0;
    for (const taskId of taskIds) {
      const taskResults = this.results.filter(r => r.taskId === taskId);
      if (taskResults.some(r => r.skillReused && r.success)) {
        transferredCount++;
      }
    }

    return (transferredCount / taskIds.length) * 100;
  }

  # 진화 메트릭 계산
  private calcSkillReuse(): number {
    if (this.results.length === 0) return 0;
    const reusedCount = this.results.filter(r => r.skillReused).length;
    return (reusedCount / this.results.length) * 100;
  }

  private calcImprovement(): number {
    const curve = this.calcLearningCurve();
    if (curve.length < 2) return 0;

    let totalImprovement = 0;
    for (let i = 1; i < curve.length; i++) {
      totalImprovement += curve[i] - curve[i - 1];
    }

    return totalImprovement / (curve.length - 1);
  }

  private calcRegression(): number {
    const curve = this.calcLearningCurve();
    if (curve.length < 2) return 0;

    let regressionCount = 0;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i] < curve[i - 1]) regressionCount++;
    }

    return (regressionCount / (curve.length - 1)) * 100;
  }

  private calcNovelty(): number {
    if (this.results.length === 0) return 0;
    const reusedCount = this.results.filter(r => r.skillReused).length;
    return ((this.results.length - reusedCount) / this.results.length) * 100;
  }

  # 안정성 메트릭 계산
  private calcRollback(): number {
    if (this.results.length === 0) return 0;
    const rollbackCount = this.results.filter(r => !r.success).length;
    return (rollbackCount / this.results.length) * 100;
  }

  private calcRecoveryTime(): number {
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length === 0) return 0;

    return failedResults.reduce((sum, r) => sum + r.durationMs, 0) / failedResults.length;
  }

  private calcConsistency(): number {
    const taskIds = [...new Set(this.results.map(r => r.taskId))];
    if (taskIds.length === 0) return 0;

    let consistentCount = 0;
    for (const taskId of taskIds) {
      const taskResults = this.results.filter(r => r.taskId === taskId);
      if (taskResults.length < 2) continue;

      const outputs = taskResults.map(r => JSON.stringify(r.output));
      const uniqueOutputs = new Set(outputs);
      if (uniqueOutputs.size === 1) consistentCount++;
    }

    return (consistentCount / taskIds.length) * 100;
  }
}
```

#### report-generator.ts

```typescript
import { BenchmarkReport } from './benchmark-suite';

export class ReportGenerator {
  # JSON 리포트
  toJSON(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }

  # 마크다운 리포트
  toMarkdown(report: BenchmarkReport): string {
    return `# 벤치마크 리포트

## 메타데이터
- **총 이터레이션**: ${report.metadata.totalIterations}
- **총 태스크**: ${report.metadata.totalTasks}
- **소요 시간**: ${(report.metadata.durationMs / 1000).toFixed(1)}초

## 성능 메트릭
| 메트릭 | 값 |
|--------|-----|
| 성공률 | ${report.performance.successRate.toFixed(1)}% |
| 토큰 효율 | ${report.performance.tokenEfficiency.toFixed(3)} |
| 전이율 | ${report.performance.transferRate.toFixed(1)}% |

## 진화 메트릭
| 메트릭 | 값 |
|--------|-----|
| 스킬 재사용률 | ${report.evolution.skillReuseRate.toFixed(1)}% |
| 개선 속도 | ${report.evolution.improvementRate.toFixed(3)} |
| 퇴화율 | ${report.evolution.regressionRate.toFixed(1)}% |
| 신규성 | ${report.evolution.noveltyScore.toFixed(1)}% |

## 안정성 메트릭
| 메트릭 | 값 |
|--------|-----|
| 롤백 빈도 | ${report.stability.rollbackRate.toFixed(1)}% |
| 복구 시간 | ${report.stability.recoveryTimeMs.toFixed(0)}ms |
| 일관성 | ${report.stability.consistencyScore.toFixed(1)}% |

## 학습 곡선
\`\`\`
${report.performance.learningCurve.map((v, i) => `${i}: ${v.toFixed(1)}%`).join('\n')}
\`\`\`
`;
  }

  # CSV 리포트
  toCSV(report: BenchmarkReport): string {
    const headers = [
      'iteration', 'taskId', 'success', 'tokensUsed',
      'durationMs', 'score', 'skillReused'
    ];

    const rows = report.results.map(r => [
      r.iteration,
      r.taskId,
      r.success,
      r.tokensUsed,
      r.durationMs,
      r.score,
      r.skillReused,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
```

---

## 4. 벤치마크 태스크 예시

```json
// tasks/task-01-search.json
{
  "id": "search-001",
  "name": "Sangfor 정책 검색",
  "description": "Sangfor EPP의 제어 정책 검색",
  "input": {
    "query": "Sangfor EPP 제어 정책 목록",
    "mode": "mix"
  },
  "expectedOutput": {
    "minNodes": 3,
    "minConfidence": 0.5
  },
  "timeout": 30000
}
```

---

## 5. 테스트 계획

```typescript
// benchmark-suite.test.ts
describe('BenchmarkSuite', () => {
  it('should run benchmark and generate report', async () => {
    const mockExecutor = async (task: Task) => ({
      iteration: 0,
      taskId: task.id,
      success: true,
      tokensUsed: 1000,
      durationMs: 500,
      output: {},
      score: 0.8,
      skillReused: false,
      timestamp: new Date(),
    });

    const suite = new BenchmarkSuite(mockExecutor);
    const tasks = [{ id: 'test', name: 'test', description: '', input: {} }];
    const report = await suite.runBenchmark(tasks, 5);

    expect(report.metadata.totalIterations).toBe(5);
    expect(report.performance.successRate).toBe(100);
  });
});
```

---

## 6. 검증 체크리스트

- [ ] 11가지 메트릭 자동 수집
- [ ] 이터레이션별 비교 리포트 생성
- [ ] 학습 곡선 시각화
- [ ] JSON/Markdown/CSV 내보내기
- [ ] 회귀 감지 알림 동작
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
