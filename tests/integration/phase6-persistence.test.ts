import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ApproveAction,
  CompleteProject,
  GenerateCustomerEmail,
  GenerateEstimate,
  GeneratePocPlan,
  GenerateProjectTasks,
  GenerateProposal,
  OpenMaintenanceCase,
  PrepareCfoHandoff,
  PromoteProjectCandidate,
  ProposeNewSolution,
  RegisterCustomerProduct,
  RequestExternalActionApproval,
} from '../../packages/application/src/index.js';
import {
  ConfidenceScore,
  ExternalSourceId,
  MailThread,
  ProjectCandidate,
} from '../../packages/domain/src/index.js';
import {
  PrismaApprovalRepository,
  PrismaCustomerRepository,
  PrismaLifecycleRepository,
  PrismaMailThreadRepository,
  PrismaProjectCandidateRepository,
  PrismaProjectRepository,
} from '../../packages/infrastructure/src/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('Phase 6 PostgreSQL persistence', () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const threadRepo = new PrismaMailThreadRepository(prisma);
  const candidateRepo = new PrismaProjectCandidateRepository(prisma);
  const projectRepo = new PrismaProjectRepository(prisma);
  const approvalRepo = new PrismaApprovalRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const lifecycleRepo = new PrismaLifecycleRepository(prisma);

  beforeAll(async () => {
    await prisma.maintenanceCase.deleteMany();
    await prisma.solutionProposal.deleteMany();
    await prisma.customerProduct.deleteMany();
    await prisma.cfoHandoff.deleteMany();
    await prisma.emailDraft.deleteMany();
    await prisma.pocPlan.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.estimate.deleteMany();
    await prisma.externalActionOutbox.deleteMany();
    await prisma.approvalDecision.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.taskCard.deleteMany();
    await prisma.project.deleteMany();
    await prisma.projectCandidate.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.mailMessage.deleteMany();
    await prisma.mailThread.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('promotes a candidate idempotently and creates one outbox item under approval races', async () => {
    const thread = new MailThread(
      'thread-internal-1',
      new ExternalSourceId('mail-intelligence', 'thread-external-1'),
      'Customer project',
      ['customer@example.com'],
      'analyzed'
    );
    await threadRepo.saveAggregate(thread, []);

    const candidate = new ProjectCandidate(
      'candidate-1',
      thread.id,
      null,
      new ConfidenceScore(0.9),
      'approved'
    );
    await candidateRepo.save(candidate);

    const promote = new PromoteProjectCandidate(candidateRepo, projectRepo);
    const first = await promote.execute({ candidateId: candidate.id, projectName: 'Project' });
    const second = await promote.execute({ candidateId: candidate.id, projectName: 'Project duplicate' });
    expect(second.projectId).toBe(first.projectId);
    expect(await prisma.project.count({ where: { candidateId: candidate.id } })).toBe(1);

    const request = await new RequestExternalActionApproval(projectRepo, approvalRepo).execute({
      projectId: first.projectId,
      actionType: 'email_send',
      target: 'customer@example.com',
      payload: { draftId: 'draft-1', subject: 'Proposal' },
      description: 'Send proposal',
      requestedBy: 'requester-1',
    });

    const approve = new ApproveAction(approvalRepo);
    const attempts = await Promise.allSettled([
      approve.execute({
        approvalId: request.approvalId,
        decision: 'approve',
        actor: { id: 'approver-1', roles: ['approver'] },
      }),
      approve.execute({
        approvalId: request.approvalId,
        decision: 'approve',
        actor: { id: 'approver-2', roles: ['approver'] },
      }),
    ]);

    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.approvalDecision.count({ where: { approvalId: request.approvalId } })).toBe(1);
    expect(await prisma.externalActionOutbox.count({ where: { approvalId: request.approvalId } })).toBe(1);
    expect(await prisma.auditEvent.count({
      where: { aggregateType: 'ApprovalRequest', aggregateId: request.approvalId },
    })).toBe(1);
  });

  it('persists the complete project document and maintenance lifecycle with decimal amounts', async () => {
    await prisma.organization.create({
      data: { id: 'customer-lifecycle', name: 'Lifecycle Customer', domain: 'lifecycle.test' },
    });
    await prisma.project.create({
      data: { id: 'project-lifecycle', name: 'Lifecycle Project', customerId: 'customer-lifecycle', status: 'active' },
    });

    await new GenerateProjectTasks(projectRepo, lifecycleRepo).execute({ projectId: 'project-lifecycle' });
    const estimate = await new GenerateEstimate(projectRepo, customerRepo, lifecycleRepo).execute({
      projectId: 'project-lifecycle', projectName: 'Lifecycle Project', customerName: 'Lifecycle Customer',
      items: [{ description: 'Engineering', quantity: 1.5, unitPrice: 100.10, currency: 'USD', taxRate: 7.5 }],
    });
    await new GenerateProposal(projectRepo, customerRepo, lifecycleRepo).execute({
      projectId: 'project-lifecycle', projectName: 'Lifecycle Project', customerName: 'Lifecycle Customer',
      sections: [{ title: 'Scope', content: 'Implementation' }],
    });
    await new GeneratePocPlan(projectRepo, lifecycleRepo).execute({
      projectId: 'project-lifecycle', projectName: 'Lifecycle Project', objectives: ['Validate'],
      scope: 'Core', timeline: [{ phase: 'POC', duration: '1 week' }], successCriteria: ['Pass'],
    });
    await new GenerateCustomerEmail(projectRepo, customerRepo, lifecycleRepo).execute({
      projectId: 'project-lifecycle', projectName: 'Lifecycle Project', customerName: 'Lifecycle Customer',
      recipientEmail: 'customer@lifecycle.test', purpose: 'proposal',
    });

    expect((await prisma.estimate.findUniqueOrThrow({ where: { id: estimate.estimateId } })).total.toString())
      .toBe('161.4113');
    expect(await prisma.taskCard.count({ where: { projectId: 'project-lifecycle' } })).toBe(5);
    expect(await prisma.emailDraft.count({ where: { projectId: 'project-lifecycle', status: 'draft' } })).toBe(1);

    await new CompleteProject(projectRepo).execute({ projectId: 'project-lifecycle' });
    await new PrepareCfoHandoff(projectRepo, lifecycleRepo).execute({
      projectId: 'project-lifecycle', projectName: 'Lifecycle Project',
      items: [{ category: 'Revenue', description: 'Contract', amount: 150.15, currency: 'USD' }],
    });
    const product = await new RegisterCustomerProduct(customerRepo, projectRepo, lifecycleRepo).execute({
      customerId: 'customer-lifecycle', projectId: 'project-lifecycle', projectName: 'Lifecycle Project',
      productName: 'AIOS', version: '1.0.0', installationDate: new Date('2026-06-19T00:00:00.000Z'),
    });
    const duplicateProduct = await new RegisterCustomerProduct(customerRepo, projectRepo, lifecycleRepo).execute({
      customerId: 'customer-lifecycle', projectId: 'project-lifecycle', projectName: 'Lifecycle Project',
      productName: 'AIOS', version: '1.0.0', installationDate: new Date('2026-06-19T00:00:00.000Z'),
    });
    const maintenance = await new OpenMaintenanceCase(customerRepo, lifecycleRepo).execute({
      customerId: 'customer-lifecycle', productId: product.productId,
      description: 'Upgrade', priority: 'medium',
    });
    await new ProposeNewSolution(customerRepo, lifecycleRepo).execute({
      customerId: 'customer-lifecycle', description: 'Automation expansion',
      sourceEvidence: [maintenance.caseId], estimatedValue: 500.25, currency: 'USD',
    });

    expect(await prisma.cfoHandoff.count({ where: { projectId: 'project-lifecycle' } })).toBe(1);
    expect(await prisma.customerProduct.count({ where: { id: product.productId } })).toBe(1);
    expect(duplicateProduct.productId).toBe(product.productId);
    expect(await prisma.maintenanceCase.count({ where: { id: maintenance.caseId } })).toBe(1);
    expect(await prisma.solutionProposal.count({ where: { customerId: 'customer-lifecycle' } })).toBe(1);
  });
});
