import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBuilder, formatSSE, formatSSEComment } from '../src/event-builder.js';
import type { AGUIEvent } from '../src/types.js';

// ─── EventBuilder Tests ────────────────────────────────────────

describe('EventBuilder', () => {
  it('should generate unique IDs', () => {
    const id1 = EventBuilder.generateId('msg');
    const id2 = EventBuilder.generateId('msg');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^msg-/);
  });

  it('should create a TEXT_MESSAGE_START event', () => {
    const event = EventBuilder.textMessageStart('assistant');
    expect(event.type).toBe('TEXT_MESSAGE_START');
    if (event.type === 'TEXT_MESSAGE_START') {
      expect(event.role).toBe('assistant');
      expect(event.messageId).toMatch(/^msg-/);
      expect(event.timestamp).toBeTypeOf('number');
    }
  });

  it('should create a TEXT_MESSAGE_CONTENT event', () => {
    const event = EventBuilder.textMessageContent('msg-1', 'Hello world', 'Hello');
    expect(event.type).toBe('TEXT_MESSAGE_CONTENT');
    if (event.type === 'TEXT_MESSAGE_CONTENT') {
      expect(event.messageId).toBe('msg-1');
      expect(event.content).toBe('Hello world');
      expect(event.delta).toBe('Hello');
    }
  });

  it('should create a TEXT_MESSAGE_END event', () => {
    const event = EventBuilder.textMessageEnd('msg-1', 'Full content');
    expect(event.type).toBe('TEXT_MESSAGE_END');
    if (event.type === 'TEXT_MESSAGE_END') {
      expect(event.messageId).toBe('msg-1');
      expect(event.totalContent).toBe('Full content');
    }
  });

  it('should create a TOOL_CALL_START event', () => {
    const event = EventBuilder.toolCallStart('search', { query: 'test' });
    expect(event.type).toBe('TOOL_CALL_START');
    if (event.type === 'TOOL_CALL_START') {
      expect(event.toolName).toBe('search');
      expect(event.args).toEqual({ query: 'test' });
      expect(event.toolCallId).toMatch(/^tool-/);
    }
  });

  it('should create a TOOL_CALL_CONTENT event', () => {
    const event = EventBuilder.toolCallContent('tool-1', 'result', 'res');
    expect(event.type).toBe('TOOL_CALL_CONTENT');
    if (event.type === 'TOOL_CALL_CONTENT') {
      expect(event.toolCallId).toBe('tool-1');
      expect(event.output).toBe('result');
      expect(event.delta).toBe('res');
    }
  });

  it('should create a TOOL_CALL_END event with success', () => {
    const event = EventBuilder.toolCallEnd('tool-1', 'success', { data: 1 });
    expect(event.type).toBe('TOOL_CALL_END');
    if (event.type === 'TOOL_CALL_END') {
      expect(event.status).toBe('success');
      expect(event.result).toEqual({ data: 1 });
    }
  });

  it('should create a TASK_STARTED event', () => {
    const event = EventBuilder.taskStarted('task-1', 'do something');
    expect(event.type).toBe('TASK_STARTED');
    if (event.type === 'TASK_STARTED') {
      expect(event.taskId).toBe('task-1');
      expect(event.input).toBe('do something');
    }
  });

  it('should create a TASK_COMPLETED event', () => {
    const event = EventBuilder.taskCompleted('task-1', 'result', 1500);
    expect(event.type).toBe('TASK_COMPLETED');
    if (event.type === 'TASK_COMPLETED') {
      expect(event.output).toBe('result');
      expect(event.duration).toBe(1500);
    }
  });

  it('should create a TASK_FAILED event', () => {
    const event = EventBuilder.taskFailed('task-1', 'something broke', 'executor');
    expect(event.type).toBe('TASK_FAILED');
    if (event.type === 'TASK_FAILED') {
      expect(event.error).toBe('something broke');
      expect(event.phase).toBe('executor');
    }
  });

  it('should create a PLANNER_OUTPUT event', () => {
    const event = EventBuilder.plannerOutput('task-1', ['step1', 'step2'], 'reasoning here');
    expect(event.type).toBe('PLANNER_OUTPUT');
    if (event.type === 'PLANNER_OUTPUT') {
      expect(event.plan).toEqual(['step1', 'step2']);
      expect(event.reasoning).toBe('reasoning here');
    }
  });

  it('should create an EXECUTOR_OUTPUT event', () => {
    const event = EventBuilder.executorOutput('task-1', 1, 'done');
    expect(event.type).toBe('EXECUTOR_OUTPUT');
    if (event.type === 'EXECUTOR_OUTPUT') {
      expect(event.step).toBe(1);
      expect(event.result).toBe('done');
    }
  });

  it('should create a CRITIC_OUTPUT event', () => {
    const event = EventBuilder.criticOutput('task-1', 'pass', 'looks good');
    expect(event.type).toBe('CRITIC_OUTPUT');
    if (event.type === 'CRITIC_OUTPUT') {
      expect(event.assessment).toBe('pass');
      expect(event.feedback).toBe('looks good');
    }
  });
});

// ─── formatSSE Tests ───────────────────────────────────────────

describe('formatSSE', () => {
  it('should format an event into SSE wire format', () => {
    const event: AGUIEvent = {
      type: 'TASK_STARTED',
      taskId: 't1',
      input: 'hello',
    };
    const sse = formatSSE(event);
    expect(sse).toContain('event: TASK_STARTED');
    expect(sse).toContain('data: ');
    // Should end with double newline for event termination
    expect(sse).toContain('\n\n');
  });

  it('should format SSE comment for heartbeat', () => {
    const comment = formatSSEComment('heartbeat');
    expect(comment).toBe(': heartbeat\n\n');
  });

  it('should handle events with special characters in data', () => {
    const event: AGUIEvent = {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: 'm1',
      content: 'line1\nline2',
    };
    const sse = formatSSE(event);
    expect(sse).toContain('event: TEXT_MESSAGE_CONTENT');
    expect(sse).toContain('data: ');
  });
});
