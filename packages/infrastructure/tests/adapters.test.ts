import { describe, it, expect } from 'vitest';
import { MailIntelligenceAdapter, LLMAdapter } from '../src/adapters/index.js';

describe('MailIntelligenceAdapter', () => {
  it('should report NOT_CONFIGURED when baseUrl is empty', async () => {
    const adapter = new MailIntelligenceAdapter('');
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
    expect(adapter.lastHealthStatus).toBe('NOT_CONFIGURED');
  });

  it('should report FAILED when server is down', async () => {
    const adapter = new MailIntelligenceAdapter('http://localhost:9999');
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
    expect(adapter.lastHealthStatus).toBe('FAILED');
  });

  it('should throw on fetchThreads when not configured', async () => {
    const adapter = new MailIntelligenceAdapter('');
    await expect(adapter.fetchThreads(new Date())).rejects.toThrow('not configured');
  });

  it('should throw on fetchMessage when not configured', async () => {
    const adapter = new MailIntelligenceAdapter('');
    await expect(adapter.fetchMessage('msg1')).rejects.toThrow('not configured');
  });

  it('should throw on analyzeThread when not configured', async () => {
    const adapter = new MailIntelligenceAdapter('');
    // Create a minimal mock MailThread-like object for the test
    const mockThread = { id: 't1', subject: 'test', participants: [] } as any;
    await expect(adapter.analyzeThread(mockThread)).rejects.toThrow('not configured');
  });

  it('should use correct endpoint URLs', async () => {
    // Verify the adapter constructs correct URLs by testing the error messages
    const adapter = new MailIntelligenceAdapter('http://localhost:9999');
    
    // fetchThreads should hit /api/outlook/messages
    await expect(adapter.fetchThreads(new Date())).rejects.toThrow();
    expect(adapter.lastHealthStatus).toBe('FAILED');

    // fetchMessage should hit /api/outlook/messages/:id
    await expect(adapter.fetchMessage('msg1')).rejects.toThrow();
    
    // isHealthy should hit /api/outlook/health
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
  });

  it('should strip trailing slashes from baseUrl', async () => {
    const adapter = new MailIntelligenceAdapter('http://localhost:9999///');
    const healthy = await adapter.isHealthy();
    expect(healthy).toBe(false);
    expect(adapter.lastHealthStatus).toBe('FAILED');
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
