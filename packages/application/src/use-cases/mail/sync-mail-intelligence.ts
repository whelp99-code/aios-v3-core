import {
  ConfidenceScore,
  Contact,
  EmailAddress,
  ExternalSourceId,
  MailMessage,
  MailThread,
  Organization,
  ProjectCandidate,
} from '@aios/domain';
import type {
  MailAnalysisPort,
  MailAutomationRepository,
  MailSourcePort,
  MailThreadRepository,
} from '../../ports/index.js';
import type { UseCase } from '../index.js';

export interface SyncMailIntelligenceInput {
  since: Date;
}

export interface SyncMailIntelligenceOutput {
  discovered: number;
  ingested: number;
  skipped: number;
  results: Array<{ threadId: string; customerId: string | null; candidateId: string | null }>;
}

export class SyncMailIntelligence implements UseCase<SyncMailIntelligenceInput, SyncMailIntelligenceOutput> {
  constructor(
    private readonly source: MailSourcePort,
    private readonly analysis: MailAnalysisPort,
    private readonly threadRepo: MailThreadRepository,
    private readonly automationRepo: MailAutomationRepository
  ) {}

  async execute(input: SyncMailIntelligenceInput): Promise<SyncMailIntelligenceOutput> {
    const snapshots = await this.source.listIngestibleThreads(input.since);
    const results: SyncMailIntelligenceOutput['results'] = [];
    let skipped = 0;

    for (const snapshot of snapshots) {
      const existing = await this.threadRepo.findByExternalId(
        snapshot.sourceProvider,
        snapshot.threadKey
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const details = await this.source.getThread(snapshot.threadKey);
      if (!details) {
        skipped += 1;
        continue;
      }

      const thread = new MailThread(
        globalThis.crypto.randomUUID(),
        new ExternalSourceId(snapshot.sourceProvider, snapshot.threadKey),
        snapshot.title,
        [...new Set(snapshot.participants)],
        'ingested',
        { summary: snapshot.summary, evidenceItems: snapshot.evidenceItems, ...snapshot.metadata }
      );
      const messages = details.messages.map((message) => new MailMessage(
        globalThis.crypto.randomUUID(),
        thread.id,
        message.id,
        message.sender,
        message.recipients,
        message.subject,
        message.bodyPreview,
        message.sentAt,
        [],
        { ...message.metadata, attachments: message.attachments }
      ));

      const analysis = await this.analysis.analyzeThread(thread);
      thread.analyze();

      const customerHint = analysis.customers[0];
      const customer = customerHint
        ? new Organization(
            globalThis.crypto.randomUUID(),
            customerHint.name,
            customerHint.domain?.toLowerCase() ?? null,
            'customer',
            { sourceThreadId: thread.id }
          )
        : null;
      const contact = customer && customerHint?.contactEmail
        ? this.createContact(customer.id, customerHint.name, customerHint.contactEmail)
        : null;
      const candidate = analysis.requests.length > 0 || customer !== null
        ? new ProjectCandidate(
            globalThis.crypto.randomUUID(),
            thread.id,
            customer?.id ?? null,
            new ConfidenceScore(analysis.confidence),
            'proposed',
            {
              requests: analysis.requests,
              deadlines: analysis.deadlines.map((deadline) => ({
                ...deadline,
                date: deadline.date.toISOString(),
              })),
            }
          )
        : null;

      results.push(await this.automationRepo.persistAnalysis({
        thread,
        messages,
        customer,
        contact,
        candidate,
      }));
    }

    return {
      discovered: snapshots.length,
      ingested: results.length,
      skipped,
      results,
    };
  }

  private createContact(organizationId: string, name: string, email: string): Contact | null {
    try {
      return new Contact(
        globalThis.crypto.randomUUID(),
        organizationId,
        name,
        new EmailAddress(email)
      );
    } catch {
      return null;
    }
  }
}
