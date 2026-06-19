# 📝 PR #9: Karpathy Loop 자동 학습 시스템

> **Branch**: `feature/karpathy-loop`
> **Priority**: P2
> **Duration**: 1주
> **의존성**: PR-03 (OpenSpace), PR-07 (Sandbox)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | HF 데이터셋 의존 → 자체 실행 결과 기반 학습 |
| **오픈소스** | Karpathy/AutoResearch Loop 패턴 |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드 변화** | ~400줄 추가 |

---

## 2. Karpathy Loop 흐름

```
1. Agent가 프로그램 수정
2. 5분간 학습/테스트
3. 결과 평가
4. 개선 시 커밋, 아니면 롤백
5. 반복
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

```typescript
export class KarpathyLoop {
  constructor(
    private llm: RapidMLXClient,
    private testRunner: TestRunner,
    private patcher: CodePatcher
  ) {}

  async run(maxIterations: number = 20): Promise<LoopReport> {
    const reports: IterationReport[] = [];

    for (let i = 0; i < maxIterations; i++) {
      // 1. 현재 코드 분석
      const currentCode = await this.analyzeCurrentState();

      // 2. 개선 제안 생성
      const proposal = await this.llm.chatCompletion({
        model: 'qwen3.5-9b',
        messages: [
          { role: 'system', content: '코드를 개선하세요.' },
          { role: 'user', content: `현재 코드:\n${currentCode}\n\n최근 실패:\n${this.getRecentFailures()}` },
        ],
      });

      // 3. 패치 생성 및 적용
      const patch = await this.patcher.createPatch(proposal.choices[0].message.content);
      await this.patcher.apply(patch);

      // 4. 테스트 실행
      const testResult = await this.testRunner.run({ timeout: 5 * 60 * 1000 });

      // 5. 결과 평가
      if (testResult.improved) {
        await this.patcher.commit(patch, testResult.metrics);
        reports.push({ iteration: i, improved: true, improvement: testResult.improvement });
      } else {
        await this.patcher.rollback(patch);
        reports.push({ iteration: i, improved: false, improvement: 0 });
      }
    }

    return this.generateReport(reports);
  }
}
```

---

## 4. 검증 체크리스트

- [ ] 20회 이터레이션 자동 실행
- [ ] 개선 시 커밋, 미개선 시 롤백
- [ ] 야간 스케줄 동작
- [ ] 리포트 자동 생성

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
