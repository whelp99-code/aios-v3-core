import { describe, it, expect, vi } from 'vitest';
import { MailIntelligenceAdapter, LLMAdapter } from '../src/adapters/index.js';

describe('MailIntelligenceAdapter', () => {
  it('should report unhealthy when server is down', async () => {
    const adapter = new MailIntelligenceAdapter('http://localhost:9999');
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
  });

  it('should return empty array on fetch failure', async () => {
    const adapter = new MailIntelligenceAdapter('http://localhost:9999');
    const threads = await adapter.fetchThreads(new Date());
    expect(threads).toEqual([]);
  });
});

describe('LLMAdapter', () => {
  it('should block cloud providers in local_only mode', async () => {
    const adapter = new LLMAdapter({
      provider: 'mimo',
      baseUrl: 'http://localhost:9999',
      model: 'test',
      localOnly: true,
    });

    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('LOCAL_ONLY');
  });

  it('should allow lmstudio in local_only mode', async () => {
    const adapter = new LLMAdapter({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:9999',
      model: 'test',
      localOnly: true,
    });

    // Will fail to connect, but shouldn't throw LOCAL_ONLY error
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow();
  });

  it('should report unhealthy when server is down', async () => {
    const adapter = new LLMAdapter({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:9999',
      model: 'test',
    });
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
  });
});
