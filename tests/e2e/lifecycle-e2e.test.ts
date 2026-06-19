import { describe, it, expect } from 'vitest';
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

describe('Full AIOS Lifecycle E2E', () => {
  it('Mail → Candidate → Project → Estimate → Approval → Completion', async () => {
    // Step 1: Review project candidate
    const review = new ReviewProjectCandidate();
    const reviewResult = await review.execute({
      candidateId: 'candidate-1',
      action: 'approve',
    });
    expect(reviewResult.status).toBe('approved');

    // Step 2: Promote to project
    const promote = new PromoteProjectCandidate();
    const projectResult = await promote.execute({
      candidateId: 'candidate-1',
      projectName: 'AIOS Implementation',
      customerId: 'customer-1',
    });
    expect(projectResult.projectId).toBeDefined();

    // Step 3: Generate tasks
    const tasks = new GenerateProjectTasks();
    const taskResult = await tasks.execute({ projectId: projectResult.projectId });
    expect(taskResult.tasks.length).toBeGreaterThan(0);

    // Step 4: Generate estimate
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
    const approval = new RequestExternalActionApproval();
    const approvalResult = await approval.execute({
      projectId: projectResult.projectId,
      actionType: 'email_send',
      description: 'Send estimate to customer',
      requestedBy: 'user-1',
    });
    expect(approvalResult.status).toBe('pending');

    // Step 9: Approve the action
    const approve = new ApproveAction();
    const approveResult = await approve.execute({
      approvalId: approvalResult.approvalId,
      decision: 'approve',
      actor: 'manager-1',
    });
    expect(approveResult.decision).toBe('approve');

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
