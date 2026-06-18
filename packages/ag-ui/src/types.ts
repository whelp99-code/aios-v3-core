/**
 * AG-UI Protocol Types
 * Real-time UI streaming events for AI agent communication
 */

// ─── Event Type Enums ────────────────────────────────────────────────

export const EventTypes = {
  // Text message lifecycle
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',

  // Tool call lifecycle
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_CONTENT: 'TOOL_CALL_CONTENT',
  TOOL_CALL_END: 'TOOL_CALL_END',

  // State updates
  STATE_UPDATE: 'STATE_UPDATE',

  // Lifecycle events
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',

  // Pipeline events
  PLANNER_OUTPUT: 'PLANNER_OUTPUT',
  EXECUTOR_OUTPUT: 'EXECUTOR_OUTPUT',
  CRITIC_OUTPUT: 'CRITIC_OUTPUT',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ─── Individual Event Shapes ─────────────────────────────────────────

export interface TextMessageStartEvent {
  type: 'TEXT_MESSAGE_START';
  messageId: string;
  role: 'assistant' | 'user' | 'system';
  timestamp: number;
}

export interface TextMessageContentEvent {
  type: 'TEXT_MESSAGE_CONTENT';
  messageId: string;
  content: string;
  delta?: string; // incremental content since last event
}

export interface TextMessageEndEvent {
  type: 'TEXT_MESSAGE_END';
  messageId: string;
  totalContent: string;
}

export interface ToolCallStartEvent {
  type: 'TOOL_CALL_START';
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  timestamp: number;
}

export interface ToolCallContentEvent {
  type: 'TOOL_CALL_CONTENT';
  toolCallId: string;
  output: string;
  delta?: string;
}

export interface ToolCallEndEvent {
  type: 'TOOL_CALL_END';
  toolCallId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface StateUpdateEvent {
  type: 'STATE_UPDATE';
  stateId: string;
  patch: Partial<AGUIState>;
  version: number;
  timestamp: number;
}

export interface TaskStartedEvent {
  type: 'TASK_STARTED';
  taskId: string;
  input: string;
  metadata?: Record<string, unknown>;
}

export interface TaskCompletedEvent {
  type: 'TASK_COMPLETED';
  taskId: string;
  output: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface TaskFailedEvent {
  type: 'TASK_FAILED';
  taskId: string;
  error: string;
  phase?: 'planner' | 'executor' | 'critic';
}

export interface PlannerOutputEvent {
  type: 'PLANNER_OUTPUT';
  taskId: string;
  plan: string[];
  reasoning: string;
}

export interface ExecutorOutputEvent {
  type: 'EXECUTOR_OUTPUT';
  taskId: string;
  step: number;
  result: string;
  toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>;
}

export interface CriticOutputEvent {
  type: 'CRITIC_OUTPUT';
  taskId: string;
  assessment: 'pass' | 'revise' | 'fail';
  feedback: string;
}

// ─── Union Type ──────────────────────────────────────────────────────

export type AGUIEvent =
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallContentEvent
  | ToolCallEndEvent
  | StateUpdateEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | PlannerOutputEvent
  | ExecutorOutputEvent
  | CriticOutputEvent;

// ─── State Interface ─────────────────────────────────────────────────

export interface AGUIState {
  /** Current task ID */
  taskId: string | null;
  /** Current task status */
  status: 'idle' | 'planning' | 'executing' | 'critiquing' | 'completed' | 'failed';
  /** Collected text messages */
  messages: Array<{
    id: string;
    role: 'assistant' | 'user' | 'system';
    content: string;
  }>;
  /** Active tool calls */
  toolCalls: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: unknown;
  }>;
  /** Current pipeline phase output */
  pipeline: {
    planner: string[];
    executor: Array<{ step: number; result: string }>;
    critic: { assessment: string; feedback: string } | null;
  };
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
  /** State version for optimistic updates */
  version: number;
}

// ─── Configuration Types ─────────────────────────────────────────────

export interface AGUIServerConfig {
  /** Base path for the SSE endpoint */
  basePath?: string;
  /** CORS headers */
  headers?: Record<string, string>;
  /** Maximum number of reconnection attempts for clients */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms (0 to disable) */
  heartbeatInterval?: number;
}

export interface AGUIClientConfig {
  /** SSE endpoint URL */
  endpoint: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Reconnect automatically on disconnect */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

export type AGUICallbacks = {
  onTextMessageStart?: (event: TextMessageStartEvent) => void;
  onTextMessageContent?: (event: TextMessageContentEvent) => void;
  onTextMessageEnd?: (event: TextMessageEndEvent) => void;
  onToolCallStart?: (event: ToolCallStartEvent) => void;
  onToolCallContent?: (event: ToolCallContentEvent) => void;
  onToolCallEnd?: (event: ToolCallEndEvent) => void;
  onStateUpdate?: (event: StateUpdateEvent) => void;
  onTaskStarted?: (event: TaskStartedEvent) => void;
  onTaskCompleted?: (event: TaskCompletedEvent) => void;
  onTaskFailed?: (event: TaskFailedEvent) => void;
  onPlannerOutput?: (event: PlannerOutputEvent) => void;
  onExecutorOutput?: (event: ExecutorOutputEvent) => void;
  onCriticOutput?: (event: CriticOutputEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
};
