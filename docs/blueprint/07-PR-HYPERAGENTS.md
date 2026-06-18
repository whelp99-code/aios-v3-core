# 📝 PR #6: Hyperagents 메타 인지 시스템

> **Branch**: `feature/hyperagents-meta`
> **Priority**: P2
> **Duration**: 1주
> **의존성**: PR-03 (OpenSpace), PR-07 (Sandbox)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 단순 규칙 기반 → 메타 인지 자기 수정 |
| **오픈소스** | Hyperagents 논문 기반 |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드 변화** | ~500줄 추가 |

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
│  ├─ safety-guard.ts         # 안전 장치 (무한 루프 방지)
│  └─ recursive-improver.ts   # 재귀적 개선
```

### 3.2 핵심 구현

```typescript
export class MetaCognitiveAgent {
  constructor(private llm: RapidMLXClient) {}

  async reflectAndImprove(context: {
    taskInput: string;
    executionResult: string;
    successRate: number;
  }): Promise<{
    reflection: string;
    codePatch?: string;
    improvementScore: number;
  }> {
    const reflection = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        { role: 'system', content: '메타 인지 에이전트로 자기 프로세스를 성찰하고 개선안을 제시하세요.' },
        { role: 'user', content: `작업: ${context.taskInput}\n결과: ${context.executionResult}\n성공률: ${context.successRate}` },
      ],
    });

    return {
      reflection: reflection.choices[0].message.content,
      codePatch: undefined,
      improvementScore: Math.random() * 0.3,
    };
  }
}
```

---

## 4. 안전 장치

```typescript
export class SafetyGuard {
  private maxIterations = 10;
  private iterationCount = 0;

  canProceed(): boolean {
    this.iterationCount++;
    return this.iterationCount <= this.maxIterations;
  }

  reset(): void {
    this.iterationCount = 0;
  }
}
```

---

## 5. 검증 체크리스트

- [ ] Meta Agent 동작
- [ ] 자기 수정 동작
- [ ] 무한 루프 방지 동작
- [ ] 기존 self-evolution 호환

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
