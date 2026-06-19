/**
 * Port Interfaces
 * Interfaces that infrastructure must implement.
 */

/** Source system for mail data */
export interface MailSourcePort {
  fetchThreads(since: Date): Promise<unknown[]>;
  fetchMessage(messageId: string): Promise<unknown>;
}

/** Mail analysis port */
export interface MailAnalysisPort {
  analyzeThread(thread: unknown): Promise<unknown>;
}

/** Repository interfaces */
export interface MailThreadRepository {
  save(thread: unknown): Promise<void>;
  findById(id: string): Promise<unknown | null>;
  findByExternalId(system: string, externalId: string): Promise<unknown | null>;
}

export interface CustomerRepository {
  save(customer: unknown): Promise<void>;
  findById(id: string): Promise<unknown | null>;
  findByDomain(domain: string): Promise<unknown | null>;
}

export interface ProjectCandidateRepository {
  save(candidate: unknown): Promise<void>;
  findById(id: string): Promise<unknown | null>;
  findByThreadId(threadId: string): Promise<unknown | null>;
}

export interface ApprovalRepository {
  save(request: unknown): Promise<void>;
  findById(id: string): Promise<unknown | null>;
}
