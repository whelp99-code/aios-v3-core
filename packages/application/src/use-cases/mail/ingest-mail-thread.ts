
import type { UseCase } from '../index.js';
import type { MailThreadRepository, MailSourcePort } from '../../ports/index.js';
import { MailMessage, MailThread, ExternalSourceId } from '@aios/domain';

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

    const details = await this.source.getThread(input.externalId);
    if (!details) {
      throw new Error(`Mail thread ${input.externalId} not found in ${input.sourceSystem}`);
    }

    const participants = [...new Set([
      ...details.thread.participants,
      ...details.messages.flatMap((message) => [message.sender, ...message.recipients]),
    ].filter(Boolean))];

    // Create domain entity
    const threadId = globalThis.crypto.randomUUID();
    const thread = new MailThread(
      threadId,
      new ExternalSourceId(input.sourceSystem, input.externalId),
      details.thread.title || '(no subject)',
      participants,
      'ingested',
      {
        summary: details.thread.summary,
        evidenceItems: details.thread.evidenceItems,
        sourceMetadata: details.thread.metadata,
      }
    );

    const messages = details.messages.map((message) => new MailMessage(
      globalThis.crypto.randomUUID(),
      threadId,
      message.id,
      message.sender,
      message.recipients,
      message.subject,
      message.bodyPreview,
      message.sentAt,
      [],
      { ...message.metadata, attachments: message.attachments }
    ));

    await this.threadRepo.saveAggregate(thread, messages);

    return { threadId, idempotent: false };
  }
}
