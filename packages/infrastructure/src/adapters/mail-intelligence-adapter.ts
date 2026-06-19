import type { MailSourcePort, MailAnalysisPort, HealthStatus, ThreadAnalysis } from '@aios/application';
import type { MailThread, MailMessage } from '@aios/domain';

/**
 * MailIntelligenceAdapter
 * Thin HTTP adapter connecting to the existing Mail Intelligence app.
 * Does NOT vendor or reimplement the source app.
 *
 * Endpoints:
 * - GET  /api/outlook/messages        — mail collection
 * - POST /api/outlook/analyze         — analysis
 * - GET  /api/outlook/health          — health check
 *
 * Error classification:
 * - NOT_CONFIGURED: baseUrl missing or DNS resolution failure
 * - DEGRADED: partial failures, non-200 responses
 * - FAILED: complete connection failure
 */
export class MailIntelligenceAdapter implements MailSourcePort, MailAnalysisPort {
  private readonly baseUrl: string;
  private _lastHealthStatus: HealthStatus = 'NOT_CONFIGURED';

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  get lastHealthStatus(): HealthStatus {
    return this._lastHealthStatus;
  }

  /**
   * Fetch messages from Mail Intelligence API
   */
  async fetchThreads(since: Date): Promise<MailMessage[]> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      throw new Error('MailIntelligenceAdapter: baseUrl not configured');
    }

    try {
      const url = new URL('/api/outlook/messages', this.baseUrl);
      url.searchParams.set('since', since.toISOString());

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this._lastHealthStatus = 'DEGRADED';
        throw new Error(
          `Mail Intelligence API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as unknown[];
      this._lastHealthStatus = 'HEALTHY';
      return data as MailMessage[];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this._lastHealthStatus = 'FAILED';
      } else if (this._lastHealthStatus !== 'DEGRADED') {
        this._lastHealthStatus = 'FAILED';
      }
      throw error;
    }
  }

  /**
   * Fetch a single message from Mail Intelligence API
   */
  async fetchMessage(messageId: string): Promise<MailMessage | null> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      throw new Error('MailIntelligenceAdapter: baseUrl not configured');
    }

    try {
      const url = new URL(`/api/outlook/messages/${messageId}`, this.baseUrl);
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this._lastHealthStatus = 'DEGRADED';
        throw new Error(
          `Mail Intelligence API returned ${response.status}: ${response.statusText}`
        );
      }

      this._lastHealthStatus = 'HEALTHY';
      return (await response.json()) as MailMessage;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this._lastHealthStatus = 'FAILED';
      } else if (this._lastHealthStatus !== 'DEGRADED') {
        this._lastHealthStatus = 'FAILED';
      }
      throw error;
    }
  }

  /**
   * Analyze a thread using Mail Intelligence
   */
  async analyzeThread(thread: MailThread): Promise<ThreadAnalysis> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      throw new Error('MailIntelligenceAdapter: baseUrl not configured');
    }

    try {
      const url = new URL('/api/outlook/analyze', this.baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.id,
          subject: thread.subject,
          participants: thread.participants,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this._lastHealthStatus = 'DEGRADED';
        throw new Error(
          `Mail Intelligence analyze returned ${response.status}: ${response.statusText}`
        );
      }

      const result = (await response.json()) as ThreadAnalysis;
      this._lastHealthStatus = 'HEALTHY';
      return result;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this._lastHealthStatus = 'FAILED';
      } else if (this._lastHealthStatus !== 'DEGRADED') {
        this._lastHealthStatus = 'FAILED';
      }
      throw error;
    }
  }

  /**
   * Health check against the Mail Intelligence service
   */
  async isHealthy(): Promise<boolean> {
    if (!this.baseUrl) {
      this._lastHealthStatus = 'NOT_CONFIGURED';
      return false;
    }

    try {
      const url = new URL('/api/outlook/health', this.baseUrl);
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(5_000),
      });
      this._lastHealthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
      return response.ok;
    } catch {
      this._lastHealthStatus = 'FAILED';
      return false;
    }
  }
}
