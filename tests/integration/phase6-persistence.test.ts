import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ApproveAction,
  PromoteProjectCandidate,
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

  beforeAll(async () => {
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

    const request = await new RequestExternalActionApproval(approvalRepo).execute({
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
});
