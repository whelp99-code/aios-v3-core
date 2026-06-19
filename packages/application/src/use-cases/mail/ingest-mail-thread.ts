
import type { UseCase } from '../index.js';
import type { MailThreadRepository, MailSourcePort } from '../../ports/index.js';
import { MailThread, ExternalSourceId } from '@aios/domain';

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
        threadId: existing.id,
        idempotent: true,
      };
    }

    // Fetch from source (single message represents the thread anchor)
    const raw = await this.source.fetchMessage(input.externalId);

    // Build participants from message sender/recipients
    const participants: string[] = [];
    if (raw) {
      if (raw.sender) participants.push(raw.sender);
      if (Array.isArray(raw.recipients)) participants.push(...raw.recipients);
    }

    // Create domain entity
    const threadId = globalThis.crypto.randomUUID();
    const thread = new MailThread(
      threadId,
      new ExternalSourceId(input.sourceSystem, input.externalId),
      raw?.subject ?? '(no subject)',
      participants,
      'ingested',
      { raw }
    );

    await this.threadRepo.save(thread);

    return { threadId, idempotent: false };
  }
}
