import type { UseCase } from '../index.js';
import type { MailThreadRepository, MailSourcePort } from '../../ports/index.js';

export interface IngestMailThreadInput {
  sourceSystem: string;
  externalId: string;
}

export interface IngestMailThreadOutput {
  threadId: string;
  idempotent: boolean;
}

/**
 * IngestMailThread
 * Fetches a mail thread from source and persists it.
 * Idempotent: returns existing thread if already ingested.
 */
export class IngestMailThread implements UseCase<IngestMailThreadInput, IngestMailThreadOutput> {
  constructor(
    private source: MailSourcePort,
    private threadRepo: MailThreadRepository
  ) {}

  async execute(input: IngestMailThreadInput): Promise<IngestMailThreadOutput> {
    // Check idempotency
    const existing = await this.threadRepo.findByExternalId(
      input.sourceSystem,
      input.externalId
    );

    if (existing) {
      return {
        threadId: (existing as { id: string }).id,
        idempotent: true,
      };
    }

    // Fetch from source
    const raw = await this.source.fetchMessage(input.externalId);

    // Save to canonical DB
    const threadId = `thread-${Date.now()}`;
    await this.threadRepo.save({
      id: threadId,
      sourceSystem: input.sourceSystem,
      externalId: input.externalId,
      status: 'ingested',
      raw,
    });

    return { threadId, idempotent: false };
  }
}
