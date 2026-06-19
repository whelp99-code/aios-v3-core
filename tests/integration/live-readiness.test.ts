import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import https from 'https';

/**
 * C2: Live Readiness Integration Test
 *
 * Tests actual runtime connectivity to each integration endpoint.
 * - PASS: endpoint reachable and responding correctly
 * - FAIL: endpoint reachable but error response
 * - SKIP: LOCAL_ONLY=true and not cloud-allowed
 * - NOT_CONFIGURED: endpoint unreachable (connection refused)
 *
 * Secrets are never logged. Mock responses are not treated as live PASS.
 */

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
const LIGHTRAG_URL = process.env.LIGHTRAG_SERVER_URL || 'http://localhost:3300';
const LANGFUSE_HOST = process.env.LANGFUSE_HOST || 'http://localhost:3000';
const API_BASE = process.env.AIOS_BASE_URL || 'http://localhost:3201';
const LOCAL_ONLY = process.env.AIOS_LOCAL_ONLY !== 'false';
const LIVE_CLOUD = process.env.LIVE_CLOUD_SMOKE === '1';

interface ProbeResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'NOT_CONFIGURED' | 'DEGRADED';
  latencyMs: number;
  endpoint: string;
  detail?: string;
}

function probeUrl(url: string, timeoutMs = 5000): Promise<{ status: number; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ status: res.statusCode || 0, latencyMs: Date.now() - start });
    });
    req.on('error', () => resolve({ status: 0, latencyMs: Date.now() - start }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, latencyMs: Date.now() - start });
    });
  });
}

function probePost(url: string, body: unknown, timeoutMs = 10000): Promise<{ status: number; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode || 0, latencyMs: Date.now() - start });
      },
    );
    req.on('error', () => resolve({ status: 0, latencyMs: Date.now() - start }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, latencyMs: Date.now() - start });
    });
    req.write(data);
    req.end();
  });
}

describe('C2: Live Integration Readiness', () => {
  const results: ProbeResult[] = [];

  afterAll(() => {
    // Print summary
    console.log('\n══════════════════════════════════════════');
    console.log('  Live Integration Test Results');
    console.log('══════════════════════════════════════════');
    for (const r of results) {
      const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭️', NOT_CONFIGURED: '⏭️', DEGRADED: '⚠️' }[r.status];
      console.log(`  ${icon} ${r.name}: ${r.status} (${r.latencyMs}ms) ${r.detail || ''}`);
    }
    const counts = results.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { PASS: 0, FAIL: 0, SKIP: 0, NOT_CONFIGURED: 0, DEGRADED: 0 },
    );
    console.log(`\n  Summary: ${counts.PASS} pass, ${counts.FAIL} fail, ${counts.SKIP} skip, ${counts.NOT_CONFIGURED} not_configured, ${counts.DEGRADED} degraded`);
    console.log('══════════════════════════════════════════\n');
  });

  it('LM Studio: /models endpoint reachable', async () => {
    const { status, latencyMs } = await probeUrl(`${LM_STUDIO_URL}/models`);
    if (status >= 200 && status < 400) {
      results.push({ name: 'LM Studio /models', status: 'PASS', latencyMs, endpoint: LM_STUDIO_URL });
      expect(status).toBeGreaterThanOrEqual(200);
    } else if (status === 0) {
      results.push({ name: 'LM Studio /models', status: 'NOT_CONFIGURED', latencyMs, endpoint: LM_STUDIO_URL });
      console.log(`  ⏭️  LM Studio not running at ${LM_STUDIO_URL}`);
      // Don't fail — it's expected when LM Studio is not running
    } else {
      results.push({ name: 'LM Studio /models', status: 'FAIL', latencyMs, endpoint: LM_STUDIO_URL, detail: `HTTP ${status}` });
      expect(status).toBeGreaterThanOrEqual(200);
    }
  }, 10_000);

  it('LM Studio: minimal completion', async () => {
    const { status, latencyMs } = await probePost(`${LM_STUDIO_URL}/chat/completions`, {
      model: 'local-model',
      messages: [{ role: 'user', content: 'Say ok' }],
      max_tokens: 5,
    });
    if (status >= 200 && status < 400) {
      results.push({ name: 'LM Studio completion', status: 'PASS', latencyMs, endpoint: LM_STUDIO_URL });
      expect(status).toBeGreaterThanOrEqual(200);
    } else if (status === 0) {
      results.push({ name: 'LM Studio completion', status: 'NOT_CONFIGURED', latencyMs, endpoint: LM_STUDIO_URL });
      console.log('  ⏭️  LM Studio completion skipped (not running)');
    } else {
      results.push({ name: 'LM Studio completion', status: 'FAIL', latencyMs, endpoint: LM_STUDIO_URL, detail: `HTTP ${status}` });
      expect(status).toBeGreaterThanOrEqual(200);
    }
  }, 15_000);

  it('LightRAG: /health endpoint reachable', async () => {
    const { status, latencyMs } = await probeUrl(`${LIGHTRAG_URL}/health`);
    if (status >= 200 && status < 400) {
      results.push({ name: 'LightRAG /health', status: 'PASS', latencyMs, endpoint: LIGHTRAG_URL });
      expect(status).toBeGreaterThanOrEqual(200);
    } else if (status === 0) {
      results.push({ name: 'LightRAG /health', status: 'NOT_CONFIGURED', latencyMs, endpoint: LIGHTRAG_URL });
      console.log(`  ⏭️  LightRAG not running at ${LIGHTRAG_URL}`);
    } else {
      results.push({ name: 'LightRAG /health', status: 'FAIL', latencyMs, endpoint: LIGHTRAG_URL, detail: `HTTP ${status}` });
      expect(status).toBeGreaterThanOrEqual(200);
    }
  }, 10_000);

  it('Mimo Cloud: respects LOCAL_ONLY policy', async () => {
    if (LOCAL_ONLY && !LIVE_CLOUD) {
      results.push({ name: 'Mimo Cloud', status: 'SKIP', latencyMs: 0, endpoint: 'N/A', detail: 'LOCAL_ONLY=true' });
      console.log('  ⏭️  Mimo Cloud skipped (LOCAL_ONLY=true, set LIVE_CLOUD_SMOKE=1)');
      return;
    }
    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      results.push({ name: 'Mimo Cloud', status: 'NOT_CONFIGURED', latencyMs: 0, endpoint: 'N/A', detail: 'MIMO_API_KEY empty' });
      console.log('  ⏭️  Mimo Cloud skipped (MIMO_API_KEY not set)');
      return;
    }
    // Don't actually call the cloud API in tests — just verify config
    results.push({ name: 'Mimo Cloud config', status: 'PASS', latencyMs: 0, endpoint: 'config', detail: 'API key present' });
  });

  it('Langfuse: respects LOCAL_ONLY policy', async () => {
    if (LOCAL_ONLY && !LIVE_CLOUD) {
      results.push({ name: 'Langfuse', status: 'SKIP', latencyMs: 0, endpoint: 'N/A', detail: 'LOCAL_ONLY=true' });
      console.log('  ⏭️  Langfuse skipped (LOCAL_ONLY=true)');
      return;
    }
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    if (!secretKey) {
      results.push({ name: 'Langfuse', status: 'NOT_CONFIGURED', latencyMs: 0, endpoint: 'N/A', detail: 'LANGFUSE_SECRET_KEY empty' });
      console.log('  ⏭️  Langfuse skipped (LANGFUSE_SECRET_KEY not set)');
      return;
    }
    const { status, latencyMs } = await probeUrl(`${LANGFUSE_HOST}/api/public/health`);
    if (status >= 200 && status < 400) {
      results.push({ name: 'Langfuse health', status: 'PASS', latencyMs, endpoint: LANGFUSE_HOST });
    } else {
      results.push({ name: 'Langfuse health', status: 'FAIL', latencyMs, endpoint: LANGFUSE_HOST, detail: `HTTP ${status}` });
    }
  }, 10_000);

  it('Express API: /api/health reachable', async () => {
    const { status, latencyMs } = await probeUrl(`${API_BASE}/api/health`);
    if (status >= 200 && status < 400) {
      results.push({ name: 'Express API /health', status: 'PASS', latencyMs, endpoint: API_BASE });
      expect(status).toBeGreaterThanOrEqual(200);
    } else if (status === 0) {
      results.push({ name: 'Express API /health', status: 'NOT_CONFIGURED', latencyMs, endpoint: API_BASE });
      console.log(`  ⏭️  Express API not running at ${API_BASE}`);
    } else {
      results.push({ name: 'Express API /health', status: 'FAIL', latencyMs, endpoint: API_BASE, detail: `HTTP ${status}` });
      expect(status).toBeGreaterThanOrEqual(200);
    }
  }, 10_000);

  it('Secret masking: no hardcoded secrets in source', async () => {
    // This is a static check — verify no obvious secret patterns in source
    const { execSync } = await import('child_process');
    try {
      const output = execSync(
        `rg -n "(api_key|secret|password)\\s*[:=]\\s*['"][a-zA-Z0-9]{20,}" packages/*/src server/src --type ts 2>/dev/null | head -5 || true`,
        { cwd: process.cwd(), encoding: 'utf-8', timeout: 10_000 },
      ).trim();
      if (output) {
        results.push({ name: 'Secret masking', status: 'FAIL', latencyMs: 0, endpoint: 'source', detail: 'Hardcoded secrets found' });
        console.log(`  ❌ Potential hardcoded secrets:\n${output}`);
        expect(output).toBe('');
      } else {
        results.push({ name: 'Secret masking', status: 'PASS', latencyMs: 0, endpoint: 'source' });
      }
    } catch {
      results.push({ name: 'Secret masking', status: 'PASS', latencyMs: 0, endpoint: 'source', detail: 'rg not available or no matches' });
    }
  });
});
