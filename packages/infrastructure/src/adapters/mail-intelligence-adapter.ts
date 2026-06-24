import { z } from 'zod';
import type {
  HealthStatus,
  MailAnalysisPort,
  MailMessageSnapshot,
  MailSourcePort,
  MailThreadDetails,
  MailThreadSnapshot,
  ThreadAnalysis,
} from '@aios/application';
import type { MailThread } from '@aios/domain';

const recordSchema = z.record(z.string(), z.unknown());

const nextActionSchema = z.object({
  recommendedAction: z.string().optional(),
  owner: z.string().optional(),
  due: z.string().optional(),
}).passthrough();

const threadInsightSchema = z.object({
  threadKey: z.string(),
  threadTitle: z.string().default('Mail thread'),
  sourceProvider: z.string().default('mail-intelligence'),
  accountEmail: z.string().optional(),
  messageCount: z.number().int().nonnegative().default(0),
  messageIds: z.array(z.string()).default([]),
  latestReceivedAt: z.string().optional(),
  status: z.string().default('active'),
  effectiveStatus: z.string().optional(),
  aiEnhanced: z.boolean().optional(),
  summary: z.string().default(''),
  nextActions: z.array(nextActionSchema).default([]),
  evidenceItems: z.array(z.string()).default([]),
  participantDomains: z.array(z.string()).default([]),
  metadata: recordSchema.default({}),
}).passthrough();

const threadInsightsResponseSchema = z.object({
  threads: z.array(threadInsightSchema),
  count: z.number().int().nonnegative(),
});

const portalMessageSchema = z.object({
  id: z.string(),
  subject: z.string().default('(no subject)'),
  from: z.string().default('unknown'),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  receivedAt: z.string(),
  bodyPreview: z.string().default(''),
  attachmentNames: z.array(z.string()).default([]),
}).passthrough();

const portalThreadResponseSchema = z.object({
  thread: z.object({
    key: z.string().optional(),
    label: z.string().optional(),
    sourceProvider: z.string().optional(),
    count: z.number().int().nonnegative().optional(),
    messageIds: z.array(z.string()).default([]),
    participants: z.array(z.string()).default([]),
  }).passthrough(),
  messages: z.array(portalMessageSchema),
});

const entityCandidateSchema = z.object({
  email: z.string().optional(),
  domain: z.string(),
  candidateName: z.string(),
  entityRole: z.string().default('customer'),
  confidence: z.number().min(0).max(1),
}).passthrough();

const entityCandidatesResponseSchema = z.object({
  candidates: z.array(entityCandidateSchema),
  count: z.number().int().nonnegative(),
});

const calendarHintSchema = z.object({
  title: z.string(),
  when: z.string(),
  messageId: z.string().optional(),
}).passthrough();

const calendarResponseSchema = z.object({
  calendar: z.array(calendarHintSchema),
  count: z.number().int().nonnegative(),
});

export class MailIntelligenceAdapter implements MailSourcePort, MailAnalysisPort {
  private readonly baseUrl: string;
  private _lastHealthStatus: HealthStatus = 'NOT_CONFIGURED';

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  get lastHealthStatus(): HealthStatus {
    return this._lastHealthStatus;
  }

  async listIngestibleThreads(since: Date): Promise<MailThreadSnapshot[]> {
    const payload = await this.getJson(
      '/api/portal/thread-insights?sync=cache&forIngest=1',
      threadInsightsResponseSchema
    );

    return payload.threads
      .map((thread) => this.toThreadSnapshot(thread))
      .filter((thread) => !thread.latestReceivedAt || thread.latestReceivedAt >= since);
  }

  async getThread(threadKey: string): Promise<MailThreadDetails | null> {
    const encodedKey = encodeURIComponent(threadKey);
    const payload = await this.getJson(
      `/api/portal/thread/${encodedKey}`,
      portalThreadResponseSchema,
      true
    );
    if (!payload) return null;

    const messages = payload.messages.map((message): MailMessageSnapshot => ({
      id: message.id,
      sender: message.from,
      recipients: [...message.to, ...message.cc],
      subject: message.subject,
      bodyPreview: message.bodyPreview,
      sentAt: new Date(message.receivedAt),
      attachments: message.attachmentNames.map((name) => ({ name })),
      metadata: this.omitKnownMessageFields(message),
    }));

    const latestReceivedAt = messages.reduce<Date | null>(
      (latest, message) => !latest || message.sentAt > latest ? message.sentAt : latest,
      null
    );

    return {
      thread: {
        threadKey: payload.thread.key ?? threadKey,
        title: payload.thread.label ?? messages[0]?.subject ?? 'Mail thread',
        sourceProvider: payload.thread.sourceProvider ?? 'mail-intelligence',
        participants: payload.thread.participants,
        messageCount: payload.thread.count ?? messages.length,
        messageIds: payload.thread.messageIds,
        latestReceivedAt,
        status: 'active',
        summary: messages[0]?.bodyPreview ?? '',
        nextActions: [],
        evidenceItems: [],
        metadata: {},
      },
      messages,
    };
  }

  async analyzeThread(thread: MailThread): Promise<ThreadAnalysis> {
    const [insights, entities, calendar] = await Promise.all([
      this.getJson(
        '/api/portal/thread-insights?sync=cache&forIngest=0',
        threadInsightsResponseSchema
      ),
      this.getJson('/api/portal/entity-candidates?sync=cache', entityCandidatesResponseSchema),
      this.getJson('/api/portal/calendar-hints?sync=cache', calendarResponseSchema),
    ]);

    let insight = insights.threads.find((item) => item.threadKey === thread.source.id);
    if (!insight) {
      const ingestInsights = await this.getJson(
        '/api/portal/thread-insights?sync=cache&forIngest=1',
        threadInsightsResponseSchema
      );
      insight = ingestInsights.threads.find((item) => item.threadKey === thread.source.id);
    }
    if (!insight) {
      throw new Error(`Mail Intelligence thread ${thread.source.id} is not present in portal insights`);
    }

    const customerDomains = new Set(insight.participantDomains.map((domain) => domain.toLowerCase()));
    const customers = entities.candidates
      .filter((candidate) => customerDomains.has(candidate.domain.toLowerCase()))
      .map((candidate) => ({
        name: candidate.candidateName,
        domain: candidate.domain,
        contactEmail: candidate.email,
      }));

    const messageIds = new Set(insight.messageIds);
    const deadlines = calendar.calendar
      .filter((item) => !item.messageId || messageIds.has(item.messageId))
      .map((item) => ({ date: new Date(item.when), description: item.title }))
      .filter((item) => !Number.isNaN(item.date.getTime()));

    return {
      customers,
      requests: insight.nextActions.map((action) => ({
        description: action.recommendedAction ?? 'Follow up',
        category: insight.effectiveStatus ?? insight.status,
      })),
      deadlines,
      confidence: customers.length > 0 || insight.aiEnhanced ? 0.8 : 0.6,
    };
  }

  async isHealthy(): Promise<boolean> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      return false;
    }

    try {
      const response = await fetch(new URL('/api/outlook/health', this.baseUrl), {
        signal: AbortSignal.timeout(5_000),
      });
      this._lastHealthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
      return response.ok;
    } catch {
      this._lastHealthStatus = 'FAILED';
      return false;
    }
  }

  private async getJson<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  private async getJson<T>(path: string, schema: z.ZodType<T>, allowNotFound: true): Promise<T | null>;
  private async getJson<T>(
    path: string,
    schema: z.ZodType<T>,
    allowNotFound = false
  ): Promise<T | null> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      throw new Error('MailIntelligenceAdapter: baseUrl not configured');
    }

    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (allowNotFound && response.status === 404) return null;
      if (!response.ok) {
        this._lastHealthStatus = 'DEGRADED';
        throw new Error(`Mail Intelligence API returned ${response.status}: ${response.statusText}`);
      }
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) {
        this._lastHealthStatus = 'DEGRADED';
        throw new Error(`Mail Intelligence contract mismatch: ${parsed.error.message}`);
      }
      this._lastHealthStatus = 'HEALTHY';
      return parsed.data;
    } catch (error) {
      if (this._lastHealthStatus !== 'DEGRADED') this._lastHealthStatus = 'FAILED';
      throw error;
    }
  }

  private toThreadSnapshot(thread: z.infer<typeof threadInsightSchema>): MailThreadSnapshot {
    return {
      threadKey: thread.threadKey,
      title: thread.threadTitle,
      sourceProvider: thread.sourceProvider,
      participants: thread.participantDomains,
      messageCount: thread.messageCount,
      messageIds: thread.messageIds,
      latestReceivedAt: thread.latestReceivedAt ? new Date(thread.latestReceivedAt) : null,
      status: thread.effectiveStatus ?? thread.status,
      summary: thread.summary,
      nextActions: thread.nextActions.map((action) => ({
        description: action.recommendedAction ?? 'Follow up',
        ...(action.owner ? { owner: action.owner } : {}),
        ...(action.due ? { due: action.due } : {}),
      })),
      evidenceItems: thread.evidenceItems,
      metadata: { ...thread.metadata, aiEnhanced: thread.aiEnhanced ?? false },
    };
  }

  private omitKnownMessageFields(message: z.infer<typeof portalMessageSchema>): Record<string, unknown> {
    const {
      id: _id,
      subject: _subject,
      from: _from,
      to: _to,
      cc: _cc,
      receivedAt: _receivedAt,
      bodyPreview: _bodyPreview,
      attachmentNames: _attachmentNames,
      ...metadata
    } = message;
    return metadata;
  }
}
