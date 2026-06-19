import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const runLive = process.env.RUN_LIVE_TESTS === '1';
const describeLive = runLive ? describe : describe.skip;
const lmStudioUrl = process.env.LM_STUDIO_URL ?? 'http://localhost:1234/v1';
const lightRagUrl = process.env.LIGHTRAG_SERVER_URL ?? 'http://localhost:3300';
const apiBaseUrl = process.env.AIOS_BASE_URL ?? 'http://localhost:3201';
const mailBaseUrl = process.env.MAIL_INTELLIGENCE_URL ?? 'http://localhost:3301';

async function requiredResponse(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new Error(`NOT_CONFIGURED: ${url}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`DEGRADED: ${url} returned HTTP ${response.status}`);
  }
  return response;
}

async function requiredJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await requiredResponse(url, init);
  try {
    return await response.json() as T;
  } catch (error) {
    throw new Error(`DEGRADED: ${url} returned invalid JSON`, { cause: error });
  }
}

describeLive('live integration readiness', () => {
  const prisma = process.env.DATABASE_URL
    ? new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
    : null;

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('selects an installed LM Studio model and completes a request', async () => {
    const models = await requiredJson<{ data?: Array<{ id?: string }> }>(`${lmStudioUrl}/models`);
    const model = models.data?.find((item) => item.id)?.id;
    expect(model, 'DEGRADED: LM Studio /models returned no selectable model').toBeTruthy();

    const completion = await requiredJson<{ choices?: unknown[] }>(`${lmStudioUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with ok.' }],
        max_tokens: 8,
      }),
    });
    expect(completion.choices?.length).toBeGreaterThan(0);
  });

  it('requires healthy API, Mail Portal Bridge, and LightRAG endpoints', async () => {
    await Promise.all([
      requiredResponse(`${apiBaseUrl}/api/health`),
      requiredResponse(`${mailBaseUrl}/api/outlook/health`),
      requiredResponse(`${lightRagUrl}/health`),
    ]);
  });

  it('requires a reachable migrated PostgreSQL database', async () => {
    if (!prisma) throw new Error('NOT_CONFIGURED: DATABASE_URL is required for live validation');
    const migrationTable = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    expect(Number(migrationTable?.[0]?.count ?? 0)).toBeGreaterThan(0);
  });

  it('fails when the secret scanner cannot execute or finds a candidate', () => {
    let output: string;
    try {
      output = execFileSync(
        'rg',
        [
          '-n',
          String.raw`(api_key|secret|password)\s*[:=]\s*['"][a-zA-Z0-9]{20,}`,
          'packages',
          'apps',
          'server',
          '--glob',
          '*.ts',
        ],
        { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 1) output = '';
      else throw new Error('Secret scan execution failed', { cause: error });
    }
    expect(output, `Potential hardcoded secret:\n${output}`).toBe('');
  });
});
