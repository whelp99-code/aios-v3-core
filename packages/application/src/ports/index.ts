/**
 * Port Interfaces
 * Interfaces that infrastructure must implement.
 * All types are sourced from @aios/domain.
 */

import type {
  MailThread,
  MailMessage,
  Organization,
  Contact,
  ProjectCandidate,
  ApprovalRequest,
} from '@aios/domain';

/** Health status for external service adapters */
export type HealthStatus = 'HEALTHY' | 'NOT_CONFIGURED' | 'DEGRADED' | 'FAILED';

/** Source system for mail data */
export interface MailSourcePort {
  fetchThreads(since: Date): Promise<MailMessage[]>;
  fetchMessage(messageId: string): Promise<MailMessage | null>;
}

/** Mail analysis port */
export interface MailAnalysisPort {
  analyzeThread(thread: MailThread): Promise<ThreadAnalysis>;
}

/** Result of analyzing a mail thread */
export interface ThreadAnalysis {
  customers: Array<{ name: string; domain?: string; contactEmail?: string }>;
  requests: Array<{ description: string; category: string }>;
  deadlines: Array<{ date: Date; description: string }>;
  confidence: number;
}

/** Repository interfaces */
export interface MailThreadRepository {
  save(thread: MailThread): Promise<void>;
  findById(id: string): Promise<MailThread | null>;
  findByExternalId(system: string, externalId: string): Promise<MailThread | null>;
}

export interface CustomerRepository {
  save(customer: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findByDomain(domain: string): Promise<Organization | null>;
}

export interface ProjectCandidateRepository {
  save(candidate: ProjectCandidate): Promise<void>;
  findById(id: string): Promise<ProjectCandidate | null>;
  findByThreadId(threadId: string): Promise<ProjectCandidate | null>;
}

export interface ApprovalRepository {
  save(request: ApprovalRequest): Promise<void>;
  findById(id: string): Promise<ApprovalRequest | null>;
  findPendingByProject(projectId: string): Promise<ApprovalRequest[]>;
}
