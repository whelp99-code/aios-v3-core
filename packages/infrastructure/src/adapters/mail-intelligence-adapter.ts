import type { MailSourcePort, MailAnalysisPort } from '@aios/application';

/**
 * MailIntelligenceAdapter
 * Thin HTTP adapter connecting to the existing Mail Intelligence app.
 * Does NOT vendor or reimplement the source app.
 */
export class MailIntelligenceAdapter implements MailSourcePort, MailAnalysisPort {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3010') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch threads from Mail Intelligence API
   */
  async fetchThreads(since: Date): Promise<unknown[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/threads?since=${since.toISOString()}`
      );
      if (!response.ok) {
        throw new Error(`Mail Intelligence API error: ${response.status}`);
      }
      return await response.json() as unknown[];
    } catch (error) {
      // Connection failed — return empty, caller handles NOT_CONFIGURED
      console.warn('[MailIntelligenceAdapter] fetchThreads failed:', error);
      return [];
    }
  }

  /**
   * Fetch a single message from Mail Intelligence API
   */
  async fetchMessage(messageId: string): Promise<unknown> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/messages/${messageId}`
      );
      if (!response.ok) {
        throw new Error(`Mail Intelligence API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('[MailIntelligenceAdapter] fetchMessage failed:', error);
      return null;
    }
  }

  /**
   * Analyze a thread using Mail Intelligence
   */
  async analyzeThread(thread: unknown): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      });
      if (!response.ok) {
        throw new Error(`Mail Intelligence API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('[MailIntelligenceAdapter] analyzeThread failed:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
