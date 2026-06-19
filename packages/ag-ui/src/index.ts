/**
 * @aios/ag-ui
 *
 * AG-UI protocol implementation for real-time UI streaming.
 * Provides server-side SSE event streaming and client-side event consumption.
 */

// Core classes
export { AGUIServer } from './ag-ui-server.js';
export type { TaskExecutor, PipelineStep } from './ag-ui-server.js';
export { AGUIClient } from './ag-ui-client.js';

// Event builder
export { EventBuilder, formatSSE, formatSSEComment } from './event-builder.js';

// Types and constants
export { EventTypes } from './types.js';
export type {
  EventType,
  AGUIEvent,
  AGUIState,
  AGUIServerConfig,
  AGUIClientConfig,
  AGUICallbacks,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallContentEvent,
  ToolCallEndEvent,
  StateUpdateEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  PlannerOutputEvent,
  ExecutorOutputEvent,
  CriticOutputEvent,
} from './types.js';
