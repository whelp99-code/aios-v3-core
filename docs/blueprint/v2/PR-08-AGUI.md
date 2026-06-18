# 📝 PR-08: AG-UI 프로토콜 기반 실시간 UI

> **Branch**: `feature/pr-08-agui`
> **Priority**: P2
> **Duration**: 4일
> **의존성**: PR-06 (Mastra)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 폴링 → SSE 스트리밍 (ChatGPT 수준 실시간 UI) |
| **오픈소스** | [AG-UI](https://github.com/ag-ui-protocol/ag-ui) (⭐ 8k+, CopilotKit) |
| **영향 패키지** | `apps/web/` |
| **예상 코드** | ~300줄 추가 |

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

### 3.1 파일 구조

```
apps/web/
├─ app/api/agent/
│  └─ stream/
│     └─ route.ts               # ★ AG-UI 스트리밍 API
├─ components/
│  ├─ AgentStream.tsx           # ★ 에이전트 스트림 컴포넌트
│  ├─ ToolCallVisualizer.tsx    # ★ 도구 실행 시각화
│  ├─ WorkflowStatus.tsx        # ★ 워크플로우 상태
│  └─ index.ts
├─ hooks/
│  └─ useAgentStream.ts         # ★ AG-UI 훅
└─ package.json
```

### 3.2 핵심 구현

#### route.ts (서버)

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { taskInput } = await req.json();

  # SSE 스트림 응답
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        # 워크플로우 시작
        send({ type: 'TEXT_MESSAGE_START', messageId: 'plan-1' });

        # Planner
        send({ type: 'STATE_UPDATE', state: { currentStep: 'planner' } });
        send({ type: 'TEXT_MESSAGE_CONTENT', content: '계획을 수립하고 있습니다...\n\n' });

        const plan = await runPlanner(taskInput);
        send({ type: 'TEXT_MESSAGE_CONTENT', content: `## 계획\n${plan}\n\n` });

        # Executor
        send({ type: 'STATE_UPDATE', state: { currentStep: 'executor' } });
        send({ type: 'TOOL_CALL_START', toolCallId: 'executor-1' });

        const result = await runExecutor(plan);
        send({ type: 'TOOL_CALL_END', toolCallId: 'executor-1', result });
        send({ type: 'TEXT_MESSAGE_CONTENT', content: `## 실행 결과\n${result}\n\n` });

        # Critic
        send({ type: 'STATE_UPDATE', state: { currentStep: 'critic' } });
        const review = await runCritic(plan, result);
        send({ type: 'TEXT_MESSAGE_CONTENT', content: `## 검토\n${review}\n\n` });

        # 완료
        send({ type: 'TEXT_MESSAGE_END', messageId: 'plan-1' });

      } catch (error) {
        send({ type: 'TEXT_MESSAGE_CONTENT', content: `\n\n오류: ${error}` });
        send({ type: 'TEXT_MESSAGE_END', messageId: 'plan-1' });
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### useAgentStream.ts (클라이언트 훅)

```typescript
'use client';

import { useState, useCallback } from 'react';

export interface AgentMessage {
  id: string;
  type: 'text' | 'tool' | 'state';
  content: string;
  toolCallId?: string;
  result?: any;
}

export function useAgentStream() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentState, setCurrentState] = useState<string>('idle');

  const startStream = useCallback(async (taskInput: string) => {
    setIsStreaming(true);
    setMessages([]);
    setCurrentState('planning');

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInput }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch {
              # 파싱 에러 무시
            }
          }
        }
      }
    } finally {
      setIsStreaming(false);
      setCurrentState('idle');
    }
  }, []);

  const handleEvent = (event: any) => {
    switch (event.type) {
      case 'TEXT_MESSAGE_START':
        setMessages(prev => [...prev, {
          id: event.messageId,
          type: 'text',
          content: '',
        }]);
        break;

      case 'TEXT_MESSAGE_CONTENT':
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'text') {
            return [...prev.slice(0, -1), {
              ...last,
              content: last.content + event.content,
            }];
          }
          return prev;
        });
        break;

      case 'TEXT_MESSAGE_END':
        # 메시지 완료
        break;

      case 'TOOL_CALL_START':
        setMessages(prev => [...prev, {
          id: event.toolCallId,
          type: 'tool',
          content: '',
          toolCallId: event.toolCallId,
        }]);
        break;

      case 'TOOL_CALL_END':
        setMessages(prev => {
          const idx = prev.findIndex(m => m.toolCallId === event.toolCallId);
          if (idx >= 0) {
            return [...prev.slice(0, idx), {
              ...prev[idx],
              result: event.result,
            }];
          }
          return prev;
        });
        break;

      case 'STATE_UPDATE':
        setCurrentState(event.state.currentStep);
        break;
    }
  };

  return { messages, isStreaming, currentState, startStream };
}
```

#### AgentStream.tsx (컴포넌트)

```tsx
'use client';

import { useAgentStream } from '@/hooks/useAgentStream';

export function AgentStream() {
  const { messages, isStreaming, currentState, startStream } = useAgentStream();

  return (
    <div className="agent-stream">
      <div className="input-area">
        <textarea
          placeholder="작업을 입력하세요..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              startStream(e.currentTarget.value);
            }
          }}
        />
      </div>

      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.type}`}>
            {msg.type === 'text' && (
              <div className="text-content">{msg.content}</div>
            )}
            {msg.type === 'tool' && (
              <div className="tool-content">
                <span className="tool-badge">도구 실행</span>
                {msg.result && <pre>{JSON.stringify(msg.result, null, 2)}</pre>}
              </div>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="typing-indicator">
            <span className="state">{currentState}</span>
            <span className="dots">...</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 4. 테스트 계획

```typescript
describe('useAgentStream', () => {
  it('should stream events', async () => {
    const { startStream, messages } = renderHook(() => useAgentStream());
    await startStream('테스트 작업');
    expect(messages.length).toBeGreaterThan(0);
  });
});
```

---

## 5. 검증 체크리스트

- [ ] SSE 스트리밍 동작
- [ ] 에이전트 상태 실시간 표시
- [ ] 도구 실행 시각화 동작
- [ ] 모바일 반응형 동작
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
