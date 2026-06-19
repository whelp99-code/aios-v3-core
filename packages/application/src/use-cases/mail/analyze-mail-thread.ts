import type { UseCase } from '../index.js';
import type { MailThreadRepository, MailAnalysisPort } from '../../ports/index.js';

export interface AnalyzeMailThreadInput {
  threadId: string;
}

export interface AnalyzeMailThreadOutput {
  customers: unknown[];
  requests: unknown[];
  deadlines: unknown[];
  confidence: number;
}

/**
 * AnalyzeMailThread
 * Analyzes a mail thread using the analysis port.
 * Updates thread status from 'ingested' to 'analyzed'.
 */
export class AnalyzeMailThread implements UseCase<AnalyzeMailThreadInput, AnalyzeMailThreadOutput> {
  constructor(
    private threadRepo: MailThreadRepository,
    private analysis: MailAnalysisPort
  ) {}

  async execute(input: AnalyzeMailThreadInput): Promise<AnalyzeMailThreadOutput> {
    const thread = await this.threadRepo.findById(input.threadId);
    if (!thread) {
      throw new Error(`Thread ${input.threadId} not found`);
    }

    const result = await this.analysis.analyzeThread(thread);

    // Return normalized analysis
    const analysis = result as {
      customers?: unknown[];
      requests?: unknown[];
      deadlines?: unknown[];
      confidence?: number;
    };

    return {
      customers: analysis.customers ?? [],
      requests: analysis.requests ?? [],
      deadlines: analysis.deadlines ?? [],
      confidence: analysis.confidence ?? 0,
    };
  }
}
