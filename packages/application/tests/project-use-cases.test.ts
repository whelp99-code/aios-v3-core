import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReviewProjectCandidate,
  PromoteProjectCandidate,
  GenerateProjectTasks,
  RequestExternalActionApproval,
  ApproveAction
} from '../src/use-cases/project/index.js';
import { ProjectCandidate, ApprovalRequest, ConfidenceScore } from '@aios/domain';
import type { ProjectCandidateRepository, ApprovalRepository } from '../src/ports/index.js';

// --- Mock repositories ---

function mockCandidateRepo(overrides: Partial<ProjectCandidateRepository> = {}): ProjectCandidateRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByThreadId: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function mockApprovalRepo(overrides: Partial<ApprovalRepository> = {}): ApprovalRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findPendingByProject: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// --- ReviewProjectCandidate ---

describe('ReviewProjectCandidate', () => {
  it('should approve candidate', async () => {
    const candidate = new ProjectCandidate('pc1', 'thread1', null, new ConfidenceScore(0.8), 'proposed');
    const repo = mockCandidateRepo({ findById: vi.fn().mockResolvedValue(candidate) });
    const useCase = new ReviewProjectCandidate(repo);

    const result = await useCase.execute({ candidateId: 'pc1', action: 'approve' });
    expect(result.status).toBe('approved');
    expect(repo.save).toHaveBeenCalledWith(candidate);
  });

  it('should reject candidate', async () => {
    const candidate = new ProjectCandidate('pc1', 'thread1', null, new ConfidenceScore(0.3), 'proposed');
    const repo = mockCandidateRepo({ findById: vi.fn().mockResolvedValue(candidate) });
    const useCase = new ReviewProjectCandidate(repo);

    const result = await useCase.execute({ candidateId: 'pc1', action: 'reject', reason: 'Low priority' });
    expect(result.status).toBe('rejected');
  });

  it('should throw for non-existent candidate', async () => {
    const repo = mockCandidateRepo();
    const useCase = new ReviewProjectCandidate(repo);

    await expect(
      useCase.execute({ candidateId: 'missing', action: 'approve' })
    ).rejects.toThrow('not found');
  });

  it('should throw when approving rejected candidate', async () => {
    const candidate = new ProjectCandidate('pc1', 'thread1', null, new ConfidenceScore(0.5), 'rejected');
    const repo = mockCandidateRepo({ findById: vi.fn().mockResolvedValue(candidate) });
    const useCase = new ReviewProjectCandidate(repo);

    await expect(
      useCase.execute({ candidateId: 'pc1', action: 'approve' })
    ).rejects.toThrow('Cannot approve rejected candidate');
  });
});

// --- PromoteProjectCandidate ---

describe('PromoteProjectCandidate', () => {
  it('should promote approved candidate', async () => {
    const candidate = new ProjectCandidate('pc1', 'thread1', 'cust1', new ConfidenceScore(0.9), 'approved');
    const repo = mockCandidateRepo({ findById: vi.fn().mockResolvedValue(candidate) });
    const useCase = new PromoteProjectCandidate(repo);

    const result = await useCase.execute({ candidateId: 'pc1', projectName: 'New Project' });
    expect(result.projectId).toBeDefined();
    expect(result.candidateId).toBe('pc1');
  });

  it('should reject promotion of non-approved candidate', async () => {
    const candidate = new ProjectCandidate('pc1', 'thread1', null, new ConfidenceScore(0.5), 'proposed');
    const repo = mockCandidateRepo({ findById: vi.fn().mockResolvedValue(candidate) });
    const useCase = new PromoteProjectCandidate(repo);

    await expect(
      useCase.execute({ candidateId: 'pc1', projectName: 'Test' })
    ).rejects.toThrow("must be 'approved'");
  });

  it('should throw for non-existent candidate', async () => {
    const repo = mockCandidateRepo();
    const useCase = new PromoteProjectCandidate(repo);

    await expect(
      useCase.execute({ candidateId: 'missing', projectName: 'Test' })
    ).rejects.toThrow('not found');
  });
});

// --- GenerateProjectTasks ---

describe('GenerateProjectTasks', () => {
  it('should generate default tasks', async () => {
    const useCase = new GenerateProjectTasks();
    const result = await useCase.execute({ projectId: 'p1' });
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks[0].title).toBeDefined();
  });
});

// --- RequestExternalActionApproval ---

describe('RequestExternalActionApproval', () => {
  it('should create approval request with UUID', async () => {
    const repo = mockApprovalRepo();
    const useCase = new RequestExternalActionApproval(repo);

    const result = await useCase.execute({
      projectId: 'p1',
      actionType: 'email_send',
      description: 'Send proposal to client',
      requestedBy: 'user1',
    });

    expect(result.status).toBe('pending');
    expect(result.approvalId).toBeDefined();
    expect(typeof result.approvalId).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

// --- ApproveAction ---

describe('ApproveAction', () => {
  let approvalRequest: ApprovalRequest;

  beforeEach(() => {
    approvalRequest = new ApprovalRequest(
      'a1', 'p1', 'external_send', 'user1', 'pending', 'Send email'
    );
  });

  it('should approve pending request', async () => {
    const repo = mockApprovalRepo({ findById: vi.fn().mockResolvedValue(approvalRequest) });
    const useCase = new ApproveAction(repo);

    const result = await useCase.execute({
      approvalId: 'a1',
      decision: 'approve',
      actor: 'manager1',
    });

    expect(result.decision).toBe('approved');
    expect(result.decidedAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should reject pending request', async () => {
    const repo = mockApprovalRepo({ findById: vi.fn().mockResolvedValue(approvalRequest) });
    const useCase = new ApproveAction(repo);

    const result = await useCase.execute({
      approvalId: 'a1',
      decision: 'reject',
      actor: 'manager1',
      reason: 'Budget exceeded',
    });

    expect(result.decision).toBe('rejected');
    expect(approvalRequest.reason).toBe('Budget exceeded');
    expect(repo.save).toHaveBeenCalledWith(approvalRequest);
  });

  it('should reject self-approval (requestedBy === decidedBy)', async () => {
    const repo = mockApprovalRepo({ findById: vi.fn().mockResolvedValue(approvalRequest) });
    const useCase = new ApproveAction(repo);

    await expect(
      useCase.execute({
        approvalId: 'a1',
        decision: 'approve',
        actor: 'user1', // same as requestedBy
      })
    ).rejects.toThrow('cannot decide their own approval request');
  });

  it('should reject duplicate approval (already approved)', async () => {
    approvalRequest.approve('manager1');
    const repo = mockApprovalRepo({ findById: vi.fn().mockResolvedValue(approvalRequest) });
    const useCase = new ApproveAction(repo);

    await expect(
      useCase.execute({
        approvalId: 'a1',
        decision: 'approve',
        actor: 'manager2',
      })
    ).rejects.toThrow('already approved');
  });

  it('should reject duplicate rejection (already rejected)', async () => {
    approvalRequest.reject('manager1', 'first rejection');
    const repo = mockApprovalRepo({ findById: vi.fn().mockResolvedValue(approvalRequest) });
    const useCase = new ApproveAction(repo);

    await expect(
      useCase.execute({
        approvalId: 'a1',
        decision: 'reject',
        actor: 'manager2',
      })
    ).rejects.toThrow('already rejected');
  });

  it('should throw for non-existent approval', async () => {
    const repo = mockApprovalRepo();
    const useCase = new ApproveAction(repo);

    await expect(
      useCase.execute({
        approvalId: 'missing',
        decision: 'approve',
        actor: 'manager1',
      })
    ).rejects.toThrow('not found');
  });
});
