# @aios/ag-ui

AG-UI protocol implementation for real-time UI streaming in the AIOS ecosystem.

## Overview

This package provides a complete implementation of the AG-UI (Agent UI) protocol,
enabling real-time streaming of UI events from AI agents to browser clients via
Server-Sent Events (SSE).

## Architecture

```
Client (Browser)                    Server (Next.js)
┌─────────────┐                    ┌──────────────────┐
│  AGUIClient │◄─── SSE Stream ────│   AGUIServer     │
│             │                    │                  │
│  Callbacks: │                    │  Pipeline:       │
│  • onText*  │                    │  1. Planner      │
│  • onTool*  │                    │  2. Executor     │
│  • onState  │                    │  3. Critic       │
│  • onTask*  │                    │                  │
└─────────────┘                    └──────────────────┘
```

## Event Types

| Event | Description |
|-------|-------------|
| `TEXT_MESSAGE_START` | A new text message is beginning |
| `TEXT_MESSAGE_CONTENT` | Incremental text content |
| `TEXT_MESSAGE_END` | Text message is complete |
| `TOOL_CALL_START` | A tool call is beginning |
| `TOOL_CALL_CONTENT` | Tool call output streaming |
| `TOOL_CALL_END` | Tool call is complete |
| `STATE_UPDATE` | UI state patch |
| `TASK_STARTED` | Task execution started |
| `TASK_COMPLETED` | Task execution completed |
| `TASK_FAILED` | Task execution failed |
| `PLANNER_OUTPUT` | Planner phase output |
| `EXECUTOR_OUTPUT` | Executor phase output |
| `CRITIC_OUTPUT` | Critic phase output |

## Usage

### Server (Next.js App Router)

```typescript
// app/api/ag-ui/route.ts
import { AGUIServer } from '@aios/ag-ui';

const server = new AGUIServer();

export async function POST(req: Request) {
  return server.handleRequest(req, async (input, sendEvent) => {
    // Your AI logic here
    sendEvent({
      type: 'TEXT_MESSAGE_START',
      messageId: 'msg-1',
      role: 'assistant',
      timestamp: Date.now(),
    });

    sendEvent({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: 'msg-1',
      content: 'Hello! Processing your request...',
      delta: 'Hello! Processing your request...',
    });

    sendEvent({
      type: 'TEXT_MESSAGE_END',
      messageId: 'msg-1',
      totalContent: 'Hello! Processing your request...',
    });

    return 'Task completed';
  });
}
```

### Server (Pipeline Mode)

```typescript
import { AGUIServer } from '@aios/ag-ui';

const server = new AGUIServer();

export async function POST(req: Request) {
  return server.handlePipelineRequest(
    req,
    {
      planner: async (input, state, sendEvent) => {
        // Generate execution plan
        return { output: 'Step 1: ...', nextAction: 'continue' };
      },
      executor: async (plan, state, sendEvent) => {
        // Execute the plan
        return { output: 'Execution result', nextAction: 'done' };
      },
      critic: async (result, state, sendEvent) => {
        // Evaluate the result
        return { output: 'Looks good!', nextAction: 'done' };
      },
    },
    3, // max iterations
  );
}
```

### Client (Browser)

```typescript
import { AGUIClient } from '@aios/ag-ui';

const client = new AGUIClient(
  { endpoint: '/api/ag-ui' },
  {
    onTextMessageContent: (event) => {
      console.log('Streaming:', event.content);
      // Update your UI here
    },
    onTaskCompleted: (event) => {
      console.log('Task done:', event.output);
    },
    onError: (error) => {
      console.error('SSE error:', error);
    },
  }
);

client.connect();
```

### Client (Fetch-based with headers)

```typescript
const client = new AGUIClient(
  { endpoint: '/api/ag-ui', headers: { Authorization: 'Bearer ...' } },
  { onTextMessageContent: (e) => updateUI(e.content) }
);

await client.connectWithFetch('My input text');
```

## Configuration

### AGUIServer

```typescript
new AGUIServer({
  basePath: '/api/ag-ui',        // Base path (default: '/api/ag-ui')
  headers: { 'X-Custom': 'v1' }, // Extra response headers
  maxReconnectAttempts: 5,       // Max client reconnects
  heartbeatInterval: 30000,      // Heartbeat ms (0 to disable)
});
```

### AGUIClient

```typescript
new AGUIClient(
  {
    endpoint: '/api/ag-ui',
    headers: { Authorization: 'Bearer ...' },
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,        // Base delay (exponential backoff)
  },
  callbacks,
);
```

## License

MIT
