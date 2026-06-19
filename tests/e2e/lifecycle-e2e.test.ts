import { describe, it, expect, vi } from 'vitest';
import {
  ReviewProjectCandidate,
  PromoteProjectCandidate,
  GenerateProjectTasks,
  GenerateEstimate,
  GenerateProposal,
  GeneratePocPlan,
  GenerateCustomerEmail,
  RequestExternalActionApproval,
  ApproveAction,
  CompleteProject,
  PrepareCfoHandoff,
  RegisterCustomerProduct,
  OpenMaintenanceCase,
  ProposeNewSolution
} from '../../packages/application/src/index.js';
import {
  ProjectCandidate,
  ApprovalRequest,
  ConfidenceScore,
} from '../../packages/domain/src/index.js';
import type {
  ProjectCandidateRepository,
  ApprovalRepository,
} from '../../packages/application/src/ports/index.js';

/** In-memory mock candidate repo backed by a Map */
function createCandidateRepo(initial: ProjectCandidate[] = []): ProjectCandidateRepository {
  const store = new Map(initial.map((c) => [c.id, c]));
  return {
    save: vi.fn(async (c: ProjectCandidate) => { store.set(c.id, c); }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByThreadId: vi.fn(async (tid: string) =>
      [...store.values()].find((c) => c.threadId === tid) ?? null
    ),
  };
}

/** In-memory mock approval repo backed by a Map */
function createApprovalRepo(initial: ApprovalRequest[] = []): ApprovalRepository {
  const store = new Map(initial.map((a) => [a.id, a]));
  return {
    save: vi.fn(async (a: ApprovalRequest) => { store.set(a.id, a); }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findPendingByProject: vi.fn(async (pid: string) =>
      [...store.values()].filter((a) => a.projectId === pid && a.status === 'pending')
    ),
  };
}

describe('Full AIOS Lifecycle E2E', () => {
  it('Mail → Candidate → Project → Estimate → Approval → Completion', async () => {
    // Pre-seed an approved candidate
    const candidate = new ProjectCandidate(
      'candidate-1', 'thread-1', 'customer-1',
      new ConfidenceScore(0.9), 'approved'
    );
    const candidateRepo = createCandidateRepo([candidate]);
    const approvalRepo = createApprovalRepo();

    // Step 1: Review project candidate (already approved, review again to verify)
    const review = new ReviewProjectCandidate(candidateRepo);
    const reviewResult = await review.execute({
      candidateId: 'candidate-1',
      action: 'approve',
    });
    expect(reviewResult.status).toBe('approved');

    // Step 2: Promote to project
    const promote = new PromoteProjectCandidate(candidateRepo);
    const projectResult = await promote.execute({
      candidateId: 'candidate-1',
      projectName: 'AIOS Implementation',
      customerId: 'customer-1',
    });
    expect(projectResult.projectId).toBeDefined();

    // Step 3: Generate tasks (no repo needed)
    const tasks = new GenerateProjectTasks();
    const taskResult = await tasks.execute({ projectId: projectResult.projectId });
    expect(taskResult.tasks.length).toBeGreaterThan(0);

    // Step 4: Generate estimate (no repo needed)
    const estimate = new GenerateEstimate();
    const estimateResult = await estimate.execute({
      projectId: projectResult.projectId,
      projectName: 'AIOS Implementation',
      customerName: 'Test Corp',
      items: [
        { description: 'Development', quantity: 1, unitPrice: 5000000, currency: 'KRW', taxRate: 10 },
      ],
    });
    expect(estimateResult.total).toBe(5500000);
    expect(estimateResult.status).toBe('draft');

    // Step 5: Generate proposal
    const proposal = new GenerateProposal();
    const proposalResult = await proposal.execute({
      projectId: projectResult.projectId,
      projectName: 'AIOS Implementation',
      customerName: 'Test Corp',
      sections: [{ title: 'Technical Approach', content: 'AI-driven automation' }],
    });
    expect(proposalResult.status).toBe('draft');

    // Step 6: Generate POC plan
    const poc = new GeneratePocPlan();
    const pocResult = await poc.execute({
      projectId: projectResult.projectId,
      projectName: 'AIOS Implementation',
      objectives: ['Verify integration'],
      scope: 'Limited',
      timeline: [{ phase: 'Phase 1', duration: '2 weeks' }],
      successCriteria: ['All tests pass'],
    });
    expect(pocResult.status).toBe('draft');

    // Step 7: Generate customer email (draft only)
    const email = new GenerateCustomerEmail();
    const emailResult = await email.execute({
      projectId: projectResult.projectId,
      projectName: 'AIOS Implementation',
      customerName: 'Test Corp',
      recipientEmail: 'contact@test.com',
      purpose: 'estimate',
    });
    expect(emailResult.status).toBe('draft');
    expect(emailResult.approvalRequired).toBe(true);

    // Step 8: Request approval for external send
    const approval = new RequestExternalActionApproval(approvalRepo);
    const approvalResult = await approval.execute({
      projectId: projectResult.projectId,
      actionType: 'email_send',
      description: 'Send estimate to customer',
      requestedBy: 'user-1',
    });
    expect(approvalResult.status).toBe('pending');

    // Step 9: Approve the action (actor ≠ requestedBy)
    const approve = new ApproveAction(approvalRepo);
    const approveResult = await approve.execute({
      approvalId: approvalResult.approvalId,
      decision: 'approve',
      actor: 'manager-1',
    });
    expect(approveResult.decision).toBe('approved');

    // Step 10: Complete project
    const complete = new CompleteProject();
    const completeResult = await complete.execute({ projectId: projectResult.projectId });
    expect(completeResult.status).toBe('completed');
    expect(completeResult.cfoHandoffDraft).toBe(true);

    // Step 11: Prepare CFO handoff
    const cfo = new PrepareCfoHandoff();
    const cfoResult = await cfo.execute({
      projectId: projectResult.projectId,
      projectName: 'AIOS Implementation',
      items: [
        { category: 'Development', description: 'Main implementation', amount: 5000000, currency: 'KRW' },
      ],
    });
    expect(cfoResult.status).toBe('draft');
    expect(cfoResult.approvalRequired).toBe(true);

    // Step 12: Register customer product
    const product = new RegisterCustomerProduct();
    const productResult = await product.execute({
      customerId: 'customer-1',
      projectName: 'AIOS Implementation',
      productName: 'AIOS Platform',
      version: '1.0.0',
      installationDate: new Date(),
    });
    expect(productResult.productId).toBeDefined();

    // Step 13: Open maintenance case
    const maintenance = new OpenMaintenanceCase();
    const maintenanceResult = await maintenance.execute({
      customerId: 'customer-1',
      productId: productResult.productId,
      description: 'Post-launch support',
      priority: 'medium',
    });
    expect(maintenanceResult.status).toBe('open');

    // Step 14: Propose new solution
    const solution = new ProposeNewSolution();
    const solutionResult = await solution.execute({
      customerId: 'customer-1',
      description: 'AI-powered analytics upgrade',
      sourceEvidence: [maintenanceResult.caseId],
    });
    expect(solutionResult.status).toBe('proposed');
  });
});
