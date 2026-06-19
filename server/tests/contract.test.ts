import type { Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  HealthResponseSchema,
  KnowledgeDocumentSchema,
  LightRAGSearchResponseSchema,
  LightRAGStatusSchema,
  MonitoringResponseSchema,
  OrchestratorRunResponseSchema,
  OrchestratorStatusSchema,
  WorkflowExecuteResponseSchema,
  WorkflowSchema,
} from '../src/schemas/api-contract.js';

let server: Server;
let baseUrl: string;
let previousApiKey: string | undefined;

beforeAll(async () => {
  previousApiKey = process.env.API_KEY;
  delete process.env.API_KEY;

  const app = createApp({
    workflowExecutor: {
      executeNode: async (_code, options) => ({
        success: true,
        stdout: options?.env?.SANDBOX_INPUT ?? '{}',
        stderr: '',
        exitCode: 0,
        durationMs: 1,
        timedOut: false,
        oomKilled: false,
      }),
    },
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (previousApiKey === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = previousApiKey;
});

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, init);
}

describe('F-aios-v3 API contract', () => {
  it.each(['/api/health', '/health'])('serves health contract at %s', async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(await response.json()).status).toBe('ok');
  });

  it('lists and reads workflows', async () => {
    const listResponse = await request('/api/workflows');
    const workflows = WorkflowSchema.array().parse(await listResponse.json());
    expect(workflows.length).toBeGreaterThan(0);

    const itemResponse = await request(`/api/workflows/${workflows[0].id}`);
    expect(WorkflowSchema.parse(await itemResponse.json()).id).toBe(workflows[0].id);
  });

  it('executes a workflow through the injected sandbox boundary', async () => {
    const response = await request('/api/workflows/wf-001/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { source: 'contract-test' } }),
    });
    expect(response.status).toBe(200);
    const data = WorkflowExecuteResponseSchema.parse(await response.json());
    expect(data.workflowId).toBe('wf-001');
    expect(data.status).toBe('completed');
  });

  it('rejects invalid workflow input before execution', async () => {
    const response = await request('/api/workflows/wf-001/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'not-an-object' }),
    });
    expect(response.status).toBe(400);
  });

  it('serves orchestrator status and validates run requests', async () => {
    const statusResponse = await request('/api/orchestrator');
    expect(OrchestratorStatusSchema.parse(await statusResponse.json()).status).toBe('ok');

    const invalidResponse = await request('/api/orchestrator/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: '' }),
    });
    expect(invalidResponse.status).toBe(400);

    const runResponse = await request('/api/orchestrator/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'contract test' }),
    });
    expect(OrchestratorRunResponseSchema.parse(await runResponse.json()).status).toBe('queued');
  });

  it('serves knowledge and keeps idempotency keys scoped to each route', async () => {
    const listResponse = await request('/api/knowledge');
    expect(KnowledgeDocumentSchema.array().parse(await listResponse.json()).length).toBeGreaterThan(0);

    const idempotencyKey = 'shared-contract-key';
    await request('/api/orchestrator/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ task: 'first route' }),
    });
    const createResponse = await request('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ title: 'Contract', content: 'Route-scoped idempotency' }),
    });
    expect(KnowledgeDocumentSchema.parse(await createResponse.json()).title).toBe('Contract');
  });

  it('reports LightRAG degradation without claiming a live success', async () => {
    const statusResponse = await request('/api/lightrag');
    expect(LightRAGStatusSchema.parse(await statusResponse.json()).status).toBe('degraded');

    const searchResponse = await request('/api/lightrag/search?q=contract');
    const search = LightRAGSearchResponseSchema.parse(await searchResponse.json());
    expect(search.status).toBe('degraded');
    expect(search.mode).toBe('simulated');
  });

  it('serves the monitoring dashboard contract', async () => {
    const response = await request('/api/monitoring');
    expect(MonitoringResponseSchema.parse(await response.json()).status).toBe('ok');
  });
});
