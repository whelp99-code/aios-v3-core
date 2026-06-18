# 📝 PR #4: Google A2A 프로토콜

> **Branch**: `feature/a2a-protocol`
> **Priority**: P2
> **Duration**: 1주
> **의존성**: PR-02 (Mastra)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 독립 에이전트 → 상호운용 에이전트 (CrewAI, OpenHands 등과 협업) |
| **오픈소스** | [Google A2A](https://github.com/a2aproject/A2A) (⭐ 15k+, Linux Foundation) |
| **영향 패키지** | `packages/a2a-protocol/` (신규) |
| **예상 코드 변화** | 신규 ~600줄 |

---

## 2. A2A vs MCP 비교

| 비교 | MCP | A2A |
|------|-----|-----|
| **목적** | 에이전트 ↔ 도구/데이터 | 에이전트 ↔ 에이전트 |
| **통신** | 단방향 호출 | 양방향 협업 |
| **프로토콜** | JSON-RPC | JSON-RPC 2.0 + HTTP/SSE |
| **주도** | Anthropic | Google / Linux Foundation |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/a2a-protocol/
├─ src/
│  ├─ a2a-agent.ts            # A2A 에이전트 정의
│  ├─ a2a-discovery.ts        # 에이전트 발견
│  ├─ a2a-task-manager.ts     # 태스트 관리
│  ├─ a2a-security.ts         # 보안 인증
│  └─ index.ts
├─ package.json
└─ tests/
```

### 3.2 핵심 구현

```typescript
import { A2AAgent, Task, Message } from '@a2aproject/sdk';

export class AIOSAgent extends A2AAgent {
  name = 'aios-orchestrator';
  description = 'AIOS 워크플로우 오케스트레이터';
  skills = ['plan', 'execute', 'review'];

  async onTask(task: Task): Promise<Message> {
    const result = await this.orchestrator.run(task.message);
    return new Message({ role: 'agent', content: result });
  }
}

// 에이전트 발견
export class A2ADiscovery {
  async findAgents(options: { skill?: string; limit?: number }) {
    // 네트워크 상의 다른 에이전트 탐색
    // CrewAI, OpenHands, Cursor 등 자동 발견
  }
}
```

---

## 4. 검증 체크리스트

- [ ] A2A 에이전트 등록 동작
- [ ] 외부 에이전트 발견 동작
- [ ] 태스트 위임 동작
- [ ] 보안 토큰 인증 동작
- [ ] 기존 MCP 어댑터 호환

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
