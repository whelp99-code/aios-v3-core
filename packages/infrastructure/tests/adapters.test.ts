import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalSourceId, MailThread } from '@aios/domain';
import { MailIntelligenceAdapter, LLMAdapter } from '../src/adapters/index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MailIntelligenceAdapter', () => {
  it('reports NOT_CONFIGURED when baseUrl is empty', async () => {
    const adapter = new MailIntelligenceAdapter('');
    await expect(adapter.listIngestibleThreads(new Date())).rejects.toThrow('not configured');
    expect(adapter.lastHealthStatus).toBe('NOT_CONFIGURED');
  });

  it('maps the Portal Bridge thread-insights contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      threads: [{
        threadKey: 'thread-1',
        threadTitle: 'Customer request',
        sourceProvider: 'mail-intelligence',
        messageCount: 3,
        messageIds: ['m1', 'm2', 'm3'],
        latestReceivedAt: '2026-06-19T00:00:00.000Z',
        status: 'active',
        summary: 'Please prepare a quote',
        nextActions: [{ recommendedAction: 'Prepare quote', owner: 'sales' }],
        evidenceItems: ['Quote requested'],
        participantDomains: ['customer.example'],
        metadata: { userReplied: false },
      }],
      count: 1,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new MailIntelligenceAdapter('http://mail.local/');
    const threads = await adapter.listIngestibleThreads(new Date('2026-01-01'));

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      threadKey: 'thread-1',
      title: 'Customer request',
      participants: ['customer.example'],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/portal/thread-insights');
  });

  it('maps a Portal Bridge thread and its messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      thread: {
        key: 'thread-1',
        label: 'Customer request',
        count: 1,
        messageIds: ['m1'],
        participants: ['sales@customer.example'],
      },
      messages: [{
        id: 'm1',
        subject: 'Quote',
        from: 'sales@customer.example',
        to: ['owner@aios.local'],
        cc: [],
        receivedAt: '2026-06-19T00:00:00.000Z',
        bodyPreview: 'Please send a quote',
        attachmentNames: ['requirements.xlsx'],
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new MailIntelligenceAdapter('http://mail.local');
    const details = await adapter.getThread('thread-1');

    expect(details?.messages[0]).toMatchObject({
      id: 'm1',
      sender: 'sales@customer.example',
      recipients: ['owner@aios.local'],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/portal/thread/thread-1');
  });

  it('combines insight, entity, and calendar contracts into analysis', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('thread-insights')) {
        return jsonResponse({
          threads: [{
            threadKey: 'thread-1', threadTitle: 'Quote', sourceProvider: 'mail-intelligence',
            messageCount: 1, messageIds: ['m1'], status: 'active', effectiveStatus: 'urgent',
            summary: 'Quote request', nextActions: [{ recommendedAction: 'Prepare quote' }],
            evidenceItems: [], participantDomains: ['customer.example'], metadata: {}, aiEnhanced: true,
          }],
          count: 1,
        });
      }
      if (url.includes('entity-candidates')) {
        return jsonResponse({
          candidates: [{
            email: 'sales@customer.example', domain: 'customer.example',
            candidateName: 'Customer', entityRole: 'customer', confidence: 0.9,
          }],
          count: 1,
        });
      }
      return jsonResponse({
        calendar: [{ title: 'Quote deadline', when: '2026-06-30T00:00:00.000Z', messageId: 'm1' }],
        count: 1,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new MailIntelligenceAdapter('http://mail.local');
    const thread = new MailThread(
      'internal-1',
      new ExternalSourceId('mail-intelligence', 'thread-1'),
      'Quote',
      ['sales@customer.example']
    );
    const analysis = await adapter.analyzeThread(thread);

    expect(analysis.customers[0]?.domain).toBe('customer.example');
    expect(analysis.requests[0]?.description).toBe('Prepare quote');
    expect(analysis.deadlines[0]?.date).toEqual(new Date('2026-06-30T00:00:00.000Z'));
  });

  it('fails closed when a Portal Bridge response violates the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ messages: [] })));
    const adapter = new MailIntelligenceAdapter('http://mail.local');

    await expect(adapter.listIngestibleThreads(new Date())).rejects.toThrow('contract mismatch');
    expect(adapter.lastHealthStatus).toBe('DEGRADED');
  });
});

describe('LLMAdapter', () => {
  it('blocks cloud providers in local_only mode', async () => {
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
});
