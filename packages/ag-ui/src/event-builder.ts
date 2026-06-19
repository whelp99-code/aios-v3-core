/**
 * EventBuilder - Helper class to build properly formatted AG-UI SSE events
 */

import type { AGUIEvent } from './types.js';

/**
 * Formats an AGUIEvent into SSE wire format.
 * Each event is emitted as:
 *   event: <eventType>\n
 *   data: <json payload>\n
 *   \n
 *
 * Multiple `data:` lines are supported for large payloads.
 */
export function formatSSE(event: AGUIEvent): string {
  const lines: string[] = [];
  lines.push(`event: ${event.type}`);

  const payload = JSON.stringify(event);
  // Split payload into lines and prefix each with `data: `
  const dataLines = payload.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  // Empty line to terminate the event
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Creates an SSE-formatted comment (for keepalive/heartbeat).
 */
export function formatSSEComment(comment: string): string {
  return `: ${comment}\n\n`;
}

/**
 * Build an AGUIEvent with common fields populated.
 */
export class EventBuilder {
  private static _idCounter = 0;

  /** Generate a unique ID */
  static generateId(prefix = 'evt'): string {
    return `${prefix}-${Date.now()}-${++EventBuilder._idCounter}`;
  }

  /** Create a TEXT_MESSAGE_START event */
  static textMessageStart(
    role: 'assistant' | 'user' | 'system' = 'assistant',
    messageId?: string,
  ): AGUIEvent {
    return {
      type: 'TEXT_MESSAGE_START',
      messageId: messageId ?? EventBuilder.generateId('msg'),
      role,
      timestamp: Date.now(),
    };
  }

  /** Create a TEXT_MESSAGE_CONTENT event */
  static textMessageContent(messageId: string, content: string, delta?: string): AGUIEvent {
    return {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId,
      content,
      delta,
    };
  }

  /** Create a TEXT_MESSAGE_END event */
  static textMessageEnd(messageId: string, totalContent: string): AGUIEvent {
    return {
      type: 'TEXT_MESSAGE_END',
      messageId,
      totalContent,
    };
  }

  /** Create a TOOL_CALL_START event */
  static toolCallStart(
    toolName: string,
    args?: Record<string, unknown>,
    toolCallId?: string,
  ): AGUIEvent {
    return {
      type: 'TOOL_CALL_START',
      toolCallId: toolCallId ?? EventBuilder.generateId('tool'),
      toolName,
      args,
      timestamp: Date.now(),
    };
  }

  /** Create a TOOL_CALL_CONTENT event */
  static toolCallContent(toolCallId: string, output: string, delta?: string): AGUIEvent {
    return {
      type: 'TOOL_CALL_CONTENT',
      toolCallId,
      output,
      delta,
    };
  }

  /** Create a TOOL_CALL_END event */
  static toolCallEnd(
    toolCallId: string,
    status: 'success' | 'error',
    result?: unknown,
    error?: string,
  ): AGUIEvent {
    return {
      type: 'TOOL_CALL_END',
      toolCallId,
      status,
      result,
      error,
    };
  }

  /** Create a STATE_UPDATE event */
  static stateUpdate(
    stateId: string,
    patch: Record<string, unknown>,
    version: number,
  ): AGUIEvent {
    return {
      type: 'STATE_UPDATE',
      stateId,
      patch: patch as AGUIEvent extends infer E ? Partial<Record<string, unknown>> : never,
      version,
      timestamp: Date.now(),
    } as unknown as AGUIEvent;
  }

  /** Create a TASK_STARTED event */
  static taskStarted(taskId: string, input: string, metadata?: Record<string, unknown>): AGUIEvent {
    return {
      type: 'TASK_STARTED',
      taskId,
      input,
      metadata,
    };
  }

  /** Create a TASK_COMPLETED event */
  static taskCompleted(
    taskId: string,
    output: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): AGUIEvent {
    return {
      type: 'TASK_COMPLETED',
      taskId,
      output,
      duration,
      metadata,
    };
  }

  /** Create a TASK_FAILED event */
  static taskFailed(
    taskId: string,
    error: string,
    phase?: 'planner' | 'executor' | 'critic',
  ): AGUIEvent {
    return {
      type: 'TASK_FAILED',
      taskId,
      error,
      phase,
    };
  }

  /** Create a PLANNER_OUTPUT event */
  static plannerOutput(taskId: string, plan: string[], reasoning: string): AGUIEvent {
    return {
      type: 'PLANNER_OUTPUT',
      taskId,
      plan,
      reasoning,
    };
  }

  /** Create an EXECUTOR_OUTPUT event */
  static executorOutput(
    taskId: string,
    step: number,
    result: string,
    toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>,
  ): AGUIEvent {
    return {
      type: 'EXECUTOR_OUTPUT',
      taskId,
      step,
      result,
      toolCalls,
    };
  }

  /** Create a CRITIC_OUTPUT event */
  static criticOutput(
    taskId: string,
    assessment: 'pass' | 'revise' | 'fail',
    feedback: string,
  ): AGUIEvent {
    return {
      type: 'CRITIC_OUTPUT',
      taskId,
      assessment,
      feedback,
    };
  }
}
