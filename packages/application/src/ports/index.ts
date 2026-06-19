/**
 * Application ports implemented by infrastructure adapters.
 */

import type {
  ApprovalRequest,
  Contact,
  MailMessage,
  MailThread,
  Organization,
  Project,
  ProjectCandidate,
  CfoHandoffDraft,
  CustomerProduct,
  EmailDraft,
  EstimateDraft,
  MaintenanceCase,
  PocPlanDraft,
  ProposalDraft,
  SolutionProposal,
  TaskCard,
  ApprovalStatus,
  ExternalActionType,
} from '@aios/domain';

export type HealthStatus = 'HEALTHY' | 'NOT_CONFIGURED' | 'DEGRADED' | 'FAILED';

export interface MailThreadSnapshot {
  threadKey: string;
  title: string;
  sourceProvider: string;
  participants: string[];
  messageCount: number;
  messageIds: string[];
  latestReceivedAt: Date | null;
  status: string;
  summary: string;
  nextActions: Array<{ description: string; owner?: string; due?: string }>;
  evidenceItems: string[];
  metadata: Record<string, unknown>;
}

export interface MailMessageSnapshot {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  bodyPreview: string;
  sentAt: Date;
  attachments: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

export interface MailThreadDetails {
  thread: MailThreadSnapshot;
  messages: MailMessageSnapshot[];
}

export interface MailSourcePort {
  listIngestibleThreads(since: Date): Promise<MailThreadSnapshot[]>;
  getThread(threadKey: string): Promise<MailThreadDetails | null>;
}

export interface MailAnalysisPort {
  analyzeThread(thread: MailThread): Promise<ThreadAnalysis>;
}

export interface ThreadAnalysis {
  customers: Array<{ name: string; domain?: string; contactEmail?: string }>;
  requests: Array<{ description: string; category: string }>;
  deadlines: Array<{ date: Date; description: string }>;
  confidence: number;
}

export interface MailThreadRepository {
  save(thread: MailThread): Promise<void>;
  saveAggregate(thread: MailThread, messages: MailMessage[]): Promise<void>;
  findById(id: string): Promise<MailThread | null>;
  findByExternalId(system: string, externalId: string): Promise<MailThread | null>;
}

export interface MailAutomationPersistenceInput {
  thread: MailThread;
  messages: MailMessage[];
  customer: Organization | null;
  contact: Contact | null;
  candidate: ProjectCandidate | null;
}

export interface MailAutomationPersistenceResult {
  threadId: string;
  customerId: string | null;
  candidateId: string | null;
}

export interface MailAutomationRepository {
  persistAnalysis(input: MailAutomationPersistenceInput): Promise<MailAutomationPersistenceResult>;
}

export interface CustomerRepository {
  save(customer: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findByDomain(domain: string): Promise<Organization | null>;
}

export interface ContactRepository {
  save(contact: Contact): Promise<void>;
  findByEmail(email: string): Promise<Contact | null>;
}

export interface ProjectCandidateRepository {
  save(candidate: ProjectCandidate): Promise<void>;
  findById(id: string): Promise<ProjectCandidate | null>;
  findByThreadId(threadId: string): Promise<ProjectCandidate | null>;
}

export interface ProjectRepository {
  save(project: Project): Promise<Project>;
  promoteCandidate(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByCandidateId(candidateId: string): Promise<Project | null>;
}

export interface ApprovalDecisionCommand {
  approvalId: string;
  decision: Exclude<ApprovalStatus, 'pending'>;
  actorId: string;
  reason?: string;
  decidedAt: Date;
}

export interface ApprovalActor {
  id: string;
  roles: readonly string[];
}

export interface ApprovalRepository {
  save(request: ApprovalRequest): Promise<void>;
  findById(id: string): Promise<ApprovalRequest | null>;
  findPendingByProject(projectId: string): Promise<ApprovalRequest[]>;
  decidePending(input: ApprovalDecisionCommand): Promise<ApprovalRequest | null>;
}

export interface ExternalActionOutboxItem {
  id: string;
  approvalId: string;
  projectId: string;
  actionType: ExternalActionType;
  target: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface LifecycleRepository {
  saveTasks(tasks: TaskCard[]): Promise<void>;
  saveEstimate(estimate: EstimateDraft): Promise<void>;
  saveProposal(proposal: ProposalDraft): Promise<void>;
  savePocPlan(plan: PocPlanDraft): Promise<void>;
  saveEmailDraft(draft: EmailDraft): Promise<void>;
  saveCfoHandoff(handoff: CfoHandoffDraft): Promise<void>;
  saveCustomerProduct(product: CustomerProduct): Promise<CustomerProduct>;
  findCustomerProduct(id: string): Promise<CustomerProduct | null>;
  saveMaintenanceCase(maintenanceCase: MaintenanceCase): Promise<void>;
  saveSolutionProposal(proposal: SolutionProposal): Promise<void>;
}
