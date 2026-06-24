import { describe, it, expect, vi } from 'vitest';
import { MailThread, ExternalSourceId } from '@aios/domain';
import { AnalyzeMailThread, IngestMailThread, SyncMailIntelligence } from '../src/use-cases/mail/index.js';
import type {
  MailAnalysisPort,
  MailAutomationRepository,
  MailSourcePort,
  MailThreadRepository,
} from '../src/ports/index.js';

function mockThreadRepo(thread: MailThread | null): MailThreadRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    saveAggregate: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(thread),
    findByExternalId: vi.fn().mockResolvedValue(null),
  };
}

describe('AnalyzeMailThread', () => {
  it('should default omitted analysis fields', async () => {
    const thread = new MailThread(
      't1',
      new ExternalSourceId('outlook', 'external-1'),
      'Test thread',
      ['customer@example.com']
    );
    const repo = mockThreadRepo(thread);
    const analysis = {
      analyzeThread: vi.fn().mockResolvedValue({}),
    } as unknown as MailAnalysisPort;
    const useCase = new AnalyzeMailThread(repo, analysis);

    const result = await useCase.execute({ threadId: 't1' });

    expect(result).toEqual({
      customers: [],
      requests: [],
      deadlines: [],
      confidence: 0,
    });
    expect(thread.status).toBe('analyzed');
    expect(repo.save).toHaveBeenCalledWith(thread);
  });

  it('should allow re-analysis of already analyzed threads', async () => {
    const thread = new MailThread(
      't1',
      new ExternalSourceId('outlook', 'external-1'),
      'Test thread',
      ['customer@example.com'],
      'analyzed'
    );
    const repo = mockThreadRepo(thread);
    const analysis = {
      analyzeThread: vi.fn().mockResolvedValue({ confidence: 0.7 }),
    } as unknown as MailAnalysisPort;
    const useCase = new AnalyzeMailThread(repo, analysis);

    const result = await useCase.execute({ threadId: 't1' });

    expect(result.confidence).toBe(0.7);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('SyncMailIntelligence', () => {
  it('should persist email participants and prefer snapshot summary metadata', async () => {
    const source = {
      listIngestibleThreads: vi.fn().mockResolvedValue([{
        threadKey: 'thread-1',
        title: 'Customer request',
        sourceProvider: 'outlook',
        participants: ['customer.example'],
        messageCount: 1,
        messageIds: ['m1'],
        latestReceivedAt: new Date('2026-06-19T00:00:00.000Z'),
        status: 'active',
        summary: 'Fresh summary',
        nextActions: [],
        evidenceItems: ['Fresh evidence'],
        metadata: { summary: 'Stale summary', evidenceItems: [], traceId: 'abc' },
      }]),
      getThread: vi.fn().mockResolvedValue({
        thread: {
          threadKey: 'thread-1',
          title: 'Customer request',
          sourceProvider: 'outlook',
          participants: ['sender@customer.example'],
          messageCount: 1,
          messageIds: ['m1'],
          latestReceivedAt: new Date('2026-06-19T00:00:00.000Z'),
          status: 'active',
          summary: '',
          nextActions: [],
          evidenceItems: [],
          metadata: {},
        },
        messages: [{
          id: 'm1',
          sender: 'sender@customer.example',
          recipients: ['owner@aios.local'],
          subject: 'Quote',
          bodyPreview: 'Please send a quote',
          sentAt: new Date('2026-06-19T00:00:00.000Z'),
          attachments: [],
          metadata: {},
        }],
      }),
    } as unknown as MailSourcePort;
    const analysis = {
      analyzeThread: vi.fn().mockResolvedValue({
        customers: [],
        requests: [],
        deadlines: [],
        confidence: 0.5,
      }),
    } as unknown as MailAnalysisPort;
    const threadRepo = mockThreadRepo(null);
    const automationRepo = {
      persistAnalysis: vi.fn().mockResolvedValue({
        threadId: 'thread-id',
        customerId: null,
        candidateId: null,
      }),
    } as unknown as MailAutomationRepository;
    const useCase = new SyncMailIntelligence(source, analysis, threadRepo, automationRepo);

    await useCase.execute({ since: new Date(0) });

    const persisted = vi.mocked(automationRepo.persistAnalysis).mock.calls[0][0];
    expect(persisted.thread.participants).toEqual(['sender@customer.example', 'owner@aios.local']);
    expect(persisted.thread.metadata).toMatchObject({
      summary: 'Fresh summary',
      evidenceItems: ['Fresh evidence'],
      traceId: 'abc',
    });
  });
});

describe('IngestMailThread', () => {
  it('should store threads under the provider returned by the source', async () => {
    const source = {
      listIngestibleThreads: vi.fn(),
      getThread: vi.fn().mockResolvedValue({
        thread: {
          threadKey: 'thread-1',
          title: 'Customer request',
          sourceProvider: 'outlook',
          participants: ['sender@customer.example'],
          messageCount: 1,
          messageIds: ['m1'],
          latestReceivedAt: new Date('2026-06-19T00:00:00.000Z'),
          status: 'active',
          summary: '',
          nextActions: [],
          evidenceItems: [],
          metadata: {},
        },
        messages: [],
      }),
    } as unknown as MailSourcePort;
    const threadRepo = mockThreadRepo(null);
    const useCase = new IngestMailThread(source, threadRepo);

    await useCase.execute({ externalId: 'thread-1' });

    const savedThread = vi.mocked(threadRepo.saveAggregate).mock.calls[0][0];
    expect(savedThread.source.system).toBe('outlook');
  });
});
