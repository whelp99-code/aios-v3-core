import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangfuseClient, CostTracker, AlertManager, TraceMiddleware } from '../src/index.js';

// ─── LangfuseClient Tests ──────────────────────────────────────

describe('LangfuseClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a LangfuseClient with config defaults', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no connection'));
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    expect(client).toBeDefined();
    expect(client.connected).toBe(false);
  });

  it('should create a trace in healthy mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    // Wait for healthCheck to complete
    await new Promise((r) => setTimeout(r, 0));
    const trace = client.createTrace({ name: 'test-trace' });
    expect(trace).toBeDefined();
    expect(trace.name).toBe('test-trace');
    expect(trace.id).toContain('trace-');
  });

  it('should create a mock trace when unhealthy', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no connection'));
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    const trace = client.createTrace({ name: 'test-trace' });
    expect(trace.id).toContain('mock-trace-');
    expect(trace.name).toBe('test-trace');
  });

  it('should create a span under a trace', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    await new Promise((r) => setTimeout(r, 0));
    const trace = client.createTrace({ name: 'test' });
    const span = client.createSpan(trace, { name: 'test-span', input: { a: 1 } });
    expect(span).toBeDefined();
    expect(span.name).toBe('test-span');
    expect(span.id).toContain('span-');
  });

  it('should create a mock span when unhealthy', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no connection'));
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    const span = client.createSpan({}, { name: 'test-span' });
    expect(span.id).toContain('mock-span-');
    expect(span.name).toBe('test-span');
  });

  it('should flush without error in healthy mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    await new Promise((r) => setTimeout(r, 0));
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it('should flush without error in unhealthy mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no connection'));
    const client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    await expect(client.flush()).resolves.toBeUndefined();
  });
});

// ─── CostTracker Tests ─────────────────────────────────────────

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('should record usage for a known model', () => {
    const usage = tracker.recordUsage({
      model: 'gpt-4o',
      promptTokens: 1000,
      completionTokens: 500,
    });
    expect(usage.model).toBe('gpt-4o');
    expect(usage.promptTokens).toBe(1000);
    expect(usage.completionTokens).toBe(500);
    expect(usage.totalTokens).toBe(1500);
    expect(usage.costUSD).toBeGreaterThan(0);
    expect(usage.costKRW).toBeGreaterThan(0);
    expect(usage.timestamp).toBeInstanceOf(Date);
  });

  it('should record usage for a local model with zero cost', () => {
    const usage = tracker.recordUsage({
      model: 'qwen3.5-9b',
      promptTokens: 5000,
      completionTokens: 2000,
    });
    expect(usage.costUSD).toBe(0);
    expect(usage.costKRW).toBe(0);
  });

  it('should track history', () => {
    tracker.recordUsage({ model: 'gpt-4o', promptTokens: 100, completionTokens: 50 });
    tracker.recordUsage({ model: 'gpt-4o-mini', promptTokens: 200, completionTokens: 100 });
    const history = tracker.getHistory();
    expect(history.length).toBe(2);
  });

  it('should clear history', () => {
    tracker.recordUsage({ model: 'gpt-4o', promptTokens: 100, completionTokens: 50 });
    tracker.clearHistory();
    expect(tracker.getHistory().length).toBe(0);
  });

  it('should generate a daily report', () => {
    tracker.recordUsage({ model: 'gpt-4o', promptTokens: 1000, completionTokens: 500 });
    const report = tracker.getDailyReport();
    expect(report.date).toBe(new Date().toISOString().split('T')[0]);
    expect(report.totalTokens).toBe(1500);
    expect(report.topModels.length).toBeGreaterThan(0);
    expect(report.topModels[0].model).toBe('gpt-4o');
  });

  it('should aggregate session cost', () => {
    tracker.recordUsage({ model: 'gpt-4o', promptTokens: 1000, completionTokens: 500 });
    const session = tracker.getSessionCost('test-session');
    expect(session.totalTokens).toBe(1500);
    expect(session.totalCostUSD).toBeGreaterThan(0);
    expect(session.byModel['gpt-4o']).toBeDefined();
  });
});

// ─── AlertManager Tests ────────────────────────────────────────

describe('AlertManager', () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager();
  });

  it('should create an error alert', () => {
    const alert = manager.createErrorAlert('Something went wrong');
    expect(alert.type).toBe('error');
    expect(alert.severity).toBe('high');
    expect(alert.message).toBe('Something went wrong');
    expect(alert.id).toContain('alert-');
    expect(alert.timestamp).toBeInstanceOf(Date);
  });

  it('should create a latency alert with medium severity', () => {
    const alert = manager.createLatencyAlert(6000);
    expect(alert.type).toBe('latency');
    expect(alert.severity).toBe('medium');
    expect(alert.metadata?.durationMs).toBe(6000);
  });

  it('should create a latency alert with high severity for extreme latency', () => {
    const alert = manager.createLatencyAlert(15000);
    expect(alert.type).toBe('latency');
    expect(alert.severity).toBe('high');
  });

  it('should create a cost alert with medium severity', () => {
    const alert = manager.createCostAlert(15000);
    expect(alert.type).toBe('cost');
    expect(alert.severity).toBe('medium');
  });

  it('should create a cost alert with high severity for extreme cost', () => {
    const alert = manager.createCostAlert(30000);
    expect(alert.type).toBe('cost');
    expect(alert.severity).toBe('high');
  });

  it('should track and retrieve alerts', () => {
    manager.createErrorAlert('error 1');
    manager.createLatencyAlert(3000);
    const alerts = manager.getAlerts();
    expect(alerts.length).toBe(2);
  });

  it('should get recent alerts with limit', () => {
    for (let i = 0; i < 10; i++) {
      manager.createErrorAlert(`error ${i}`);
    }
    const recent = manager.getRecentAlerts(3);
    expect(recent.length).toBe(3);
  });

  it('should filter alerts by severity', () => {
    manager.createErrorAlert('high error');
    manager.createLatencyAlert(3000); // medium
    const highAlerts = manager.getAlertsBySeverity('high');
    const mediumAlerts = manager.getAlertsBySeverity('medium');
    expect(highAlerts.length).toBe(1);
    expect(mediumAlerts.length).toBe(1);
  });

  it('should clear all alerts', () => {
    manager.createErrorAlert('error');
    manager.clearAlerts();
    expect(manager.getAlerts().length).toBe(0);
  });

  it('should accept custom config', () => {
    const custom = new AlertManager({
      enabled: false,
      errorThreshold: 10,
      latencyThreshold: 2000,
      costThreshold: 50000,
    });
    const alert = custom.createErrorAlert('test');
    expect(alert).toBeDefined();
  });
});

// ─── TraceMiddleware Tests ─────────────────────────────────────

describe('TraceMiddleware', () => {
  let client: LangfuseClient;
  let middleware: TraceMiddleware;

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no connection'));
    client = new LangfuseClient({
      publicKey: 'pk-test',
      secretKey: 'sk-test',
      baseUrl: 'https://cloud.langfuse.com',
    });
    middleware = new TraceMiddleware(client);
  });

  it('should trace a successful workflow', async () => {
    const result = await middleware.traceWorkflow('test-workflow', { a: 1 }, async (ctx) => {
      expect(ctx.trace).toBeDefined();
      expect(ctx.span).toBeDefined();
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('should trace a workflow and handle errors', async () => {
    await expect(
      middleware.traceWorkflow('failing-workflow', {}, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  it('should trace a step within a workflow', async () => {
    const result = await middleware.traceWorkflow('parent', {}, async (ctx) => {
      const stepResult = await middleware.traceStep(ctx, 'child-step', { x: 1 }, async () => {
        return 42;
      });
      return stepResult;
    });
    expect(result).toBe(42);
  });

  it('should trace an LLM call', async () => {
    const result = await middleware.traceWorkflow('llm-parent', {}, async (ctx) => {
      return await middleware.traceLLMCall(
        ctx,
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 },
        async () => 'response'
      );
    });
    expect(result).toBe('response');
  });

  it('should trace a tool call', async () => {
    const result = await middleware.traceWorkflow('tool-parent', {}, async (ctx) => {
      return await middleware.traceToolCall(
        ctx,
        { toolName: 'search', arguments: { query: 'test' } },
        async () => 'tool-result'
      );
    });
    expect(result).toBe('tool-result');
  });

  it('should handle step errors gracefully', async () => {
    await expect(
      middleware.traceWorkflow('parent', {}, async (ctx) => {
        await middleware.traceStep(ctx, 'failing-step', {}, async () => {
          throw new Error('step failed');
        });
      })
    ).rejects.toThrow('step failed');
  });
});
