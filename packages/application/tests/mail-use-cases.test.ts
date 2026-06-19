import { describe, it, expect, vi } from 'vitest';
import { MailThread, ExternalSourceId } from '@aios/domain';
import { AnalyzeMailThread } from '../src/use-cases/mail/index.js';
import type { MailAnalysisPort, MailThreadRepository } from '../src/ports/index.js';

function mockThreadRepo(thread: MailThread | null): MailThreadRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
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
  });
});
