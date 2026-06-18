# 📝 PR #5: AG-UI 프로토콜 기반 실시간 UI

> **Branch**: `feature/ag-ui-streaming`
> **Priority**: P2
> **Duration**: 1주
> **의존성**: PR-02 (Mastra)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 폴링 → SSE 스트리밍 (ChatGPT 수준 실시간 UI) |
| **오픈소스** | [AG-UI](https://github.com/ag-ui-protocol/ag-ui) (⭐ 8k+, CopilotKit) |
| **영향 패키지** | `apps/web/` |
| **예상 코드 변화** | ~200줄 추가 |

---

## 2. AG-UI 이벤트 타입

| 이벤트 | 설명 | UI 효과 |
|--------|------|--------|
| `TEXT_MESSAGE_START` | 메시지 시작 | 타이핑 인디케이터 |
| `TEXT_MESSAGE_CONTENT` | 텍스트 청크 | 실시간 텍스트 표시 |
| `TEXT_MESSAGE_END` | 메시지 종료 | 완료 |
| `TOOL_CALL_START` | 도구 실행 시작 | 로딩 표시 |
| `TOOL_CALL_END` | 도구 실행 종료 | 결과 표시 |
| `STATE_UPDATE` | 상태 변경 | 워크플로우 진행 표시 |

---

## 3. 구현 지침

### 3.1 서버 (Next.js API Route)

```typescript
// apps/web/app/api/agent/stream/route.ts

import { AGUIServer } from '@ag-ui/server';

export async function POST(req: Request) {
  const server = new AGUIServer();

  return server.stream(async function*() {
    yield { type: 'TEXT_MESSAGE_START', messageId: 'plan-1' };

    for await (const step of orchestrator.run(taskInput)) {
      yield { type: 'STATE_UPDATE', state: { currentStep: step.name } };
      yield { type: 'TEXT_MESSAGE_CONTENT', content: step.output };

      if (step.hasToolCall) {
        yield { type: 'TOOL_CALL_START', toolCallId: step.toolId };
        yield { type: 'TOOL_CALL_END', toolCallId: step.toolId, result: step.result };
      }
    }

    yield { type: 'TEXT_MESSAGE_END', messageId: 'plan-1' };
  });
}
```

### 3.2 클라이언트 (React 컴포넌트)

```typescript
// apps/web/components/AgentStream.tsx

'use client';

import { useAgentStream } from '@ag-ui/client';

export function AgentStream({ taskInput }: { taskInput: string }) {
  const { messages, isStreaming, error } = useAgentStream('/api/agent/stream', { taskInput });

  return (
    <div className="agent-stream">
      {messages.map(msg => (
        <div key={msg.id} className="message">
          {msg.content}
        </div>
      ))}
      {isStreaming && <div className="typing-indicator">에이전트가 작업 중...</div>}
    </div>
  );
}
```

---

## 4. 검증 체크리스트

- [ ] SSE 스트리밍 동작
- [ ] 에이전트 상태 실시간 표시
- [ ] 도구 실행 시각화 동작
- [ ] 모바일 반응형 동작

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
