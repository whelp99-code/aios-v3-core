import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine, AgentFactory, LLMClient, StepRunner } from '../src/index.js';
import type { WorkflowConfig, WorkflowResult } from '../src/types.js';

// ─── WorkflowEngine Tests ──────────────────────────────────────

describe('WorkflowEngine', () => {
  it('should create a workflow engine', () => {
    const engine = new WorkflowEngine({ name: 'test-workflow' });
    expect(engine).toBeDefined();
  });

  it('should execute a single step workflow', async () => {
    const engine = new WorkflowEngine({ name: 'simple' });
    engine.addStep('step1', async (input) => ({ ...input, processed: true }));

    const result = await engine.execute({ data: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output.processed).toBe(true);
    expect(result.steps).toEqual(['step1']);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute a multi-step workflow with chaining', async () => {
    const engine = new WorkflowEngine({ name: 'chain' });
    engine.addStep('double', async (input) => ({ value: (input as any).value * 2 }));
    engine.addStep('add-ten', async (input) => ({ value: (input as any).value + 10 }));
    engine.addStep('stringify', async (input) => ({ result: `Value: ${(input as any).value}` }));

    const result = await engine.execute({ value: 5 });
    expect(result.success).toBe(true);
    expect(result.output.result).toBe('Value: 20');
    expect(result.steps).toEqual(['double', 'add-ten', 'stringify']);
  });

  it('should handle step errors gracefully', async () => {
    const engine = new WorkflowEngine({ name: 'failing' });
    engine.addStep('good-step', async (input) => input);
    engine.addStep('bad-step', async () => { throw new Error('step failed'); });

    const result = await engine.execute({ data: 1 });
    expect(result.success).toBe(false);
    expect(result.steps).toEqual(['good-step']);
  });

  it('should execute empty workflow', async () => {
    const engine = new WorkflowEngine({ name: 'empty' });
    const result = await engine.execute('input');
    expect(result.success).toBe(true);
    expect(result.output).toBe('input');
    expect(result.steps).toEqual([]);
  });

  it('should pass custom config options', () => {
    const engine = new WorkflowEngine({
      name: 'custom',
      maxRetries: 3,
      timeout: 10000,
      model: 'gpt-4o',
    });
    expect(engine).toBeDefined();
  });
});

// ─── AgentFactory Tests ────────────────────────────────────────

describe('AgentFactory', () => {
  it('should create a planner agent (legacy mode)', () => {
    const agent = AgentFactory.createPlanner();
    expect(agent.id).toBe('planner');
    expect(agent.name).toBe('Planner Agent');
  });

  it('should execute a planner agent', async () => {
    const agent = AgentFactory.createPlanner();
    const result = await agent.execute({ task: 'build something' } as any);
    expect(result.plan).toBeDefined();
    expect(result.steps).toEqual(['analyze', 'design', 'implement']);
  });

  it('should create an executor agent', async () => {
    const agent = AgentFactory.createExecutor();
    const result = await agent.execute({ action: 'run' } as any);
    expect(result.status).toBe('completed');
    expect(result.result).toContain('Executed');
  });

  it('should create a critic agent', async () => {
    const agent = AgentFactory.createCritic();
    const result = await agent.execute({ output: 'some code' } as any);
    expect(result.score).toBe(0.85);
    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it('should get default LLM client', () => {
    const client = AgentFactory.getDefaultLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should set and get default LLM client', () => {
    AgentFactory.setDefaultLLMClient({ baseUrl: 'http://custom:1234/v1' });
    const client = AgentFactory.getDefaultLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });
});

// ─── LLMClient Tests ──────────────────────────────────────────

describe('LLMClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create an LLM client with defaults', () => {
    const client = new LLMClient();
    expect(client).toBeDefined();
  });

  it('should create an LLM client with custom config', () => {
    const client = new LLMClient({
      baseUrl: 'http://custom:1234/v1',
      timeout: 5000,
      defaultModel: 'custom-model',
    });
    expect(client).toBeDefined();
  });

  it('should make a chat completion request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'qwen3.5-9b',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response);

    const client = new LLMClient({ baseUrl: 'http://localhost:1234/v1' });
    const response = await client.chatCompletion({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.choices[0].message.content).toBe('Hello!');
    expect(response.usage.total_tokens).toBe(15);
  });

  it('should handle chat completion errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'server error',
    } as Response);

    const client = new LLMClient();
    await expect(
      client.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow('LM Studio API error');
  });

  it('should make a simple chat request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '1', object: 'chat.completion', created: Date.now(), model: 'm',
        choices: [{ index: 0, message: { role: 'assistant', content: 'reply' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    } as Response);

    const client = new LLMClient();
    const reply = await client.chat('Hello', { systemPrompt: 'Be helpful' });
    expect(reply).toBe('reply');
  });

  it('should handle health check failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));
    const client = new LLMClient();
    const healthy = await client.healthCheck();
    expect(healthy).toBe(false);
  });
});

// ─── StepRunner Tests ──────────────────────────────────────────

describe('StepRunner', () => {
  it('should execute steps in order', async () => {
    const runner = new StepRunner();
    const order: number[] = [];
    runner.addStep({ id: 's1', name: 'first', execute: async () => { order.push(1); return 'a'; } });
    runner.addStep({ id: 's2', name: 'second', execute: async () => { order.push(2); return 'b'; } });

    const result = await runner.execute('start');
    expect(result.success).toBe(true);
    expect(order).toEqual([1, 2]);
    expect(result.steps).toEqual(['first', 'second']);
  });

  it('should handle step failure', async () => {
    const runner = new StepRunner();
    runner.addStep({ id: 's1', name: 'ok', execute: async (x) => x });
    runner.addStep({ id: 's2', name: 'fail', execute: async () => { throw new Error('boom'); } });

    const result = await runner.execute('input');
    expect(result.success).toBe(false);
  });

  it('should chain step outputs', async () => {
    const runner = new StepRunner();
    runner.addStep({ id: 's1', name: 'double', execute: async (x) => ({ v: (x as any).v * 2 }) });
    runner.addStep({ id: 's2', name: 'triple', execute: async (x) => ({ v: (x as any).v * 3 }) });

    const result = await runner.execute({ v: 5 });
    expect(result.output.v).toBe(30);
  });
});
