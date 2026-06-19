import type { UseCase } from '../index.js';
import type { MailThreadRepository, MailAnalysisPort, ThreadAnalysis } from '../../ports/index.js';

export interface AnalyzeMailThreadInput {
  threadId: string;
}

export interface AnalyzeMailThreadOutput {
  customers: ThreadAnalysis['customers'];
  requests: ThreadAnalysis['requests'];
  deadlines: ThreadAnalysis['deadlines'];
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
    thread.analyze();
    await this.threadRepo.save(thread);

    return {
      customers: result.customers ?? [],
      requests: result.requests ?? [],
      deadlines: result.deadlines ?? [],
      confidence: result.confidence ?? 0,
    };
  }
}
