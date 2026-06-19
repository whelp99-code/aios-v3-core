import { describe, it, expect } from 'vitest';
import {
  ReviewProjectCandidate,
  PromoteProjectCandidate,
  GenerateProjectTasks,
  RequestExternalActionApproval,
  ApproveAction
} from '../src/use-cases/project/index.js';

describe('ReviewProjectCandidate', () => {
  it('should approve candidate', async () => {
    const useCase = new ReviewProjectCandidate();
    const result = await useCase.execute({
      candidateId: 'pc1',
      action: 'approve',
    });
    expect(result.status).toBe('approved');
  });

  it('should reject candidate', async () => {
    const useCase = new ReviewProjectCandidate();
    const result = await useCase.execute({
      candidateId: 'pc1',
      action: 'reject',
      reason: 'Low priority',
    });
    expect(result.status).toBe('rejected');
  });
});

describe('PromoteProjectCandidate', () => {
  it('should promote to project', async () => {
    const useCase = new PromoteProjectCandidate();
    const result = await useCase.execute({
      candidateId: 'pc1',
      projectName: 'New Project',
    });
    expect(result.projectId).toBeDefined();
    expect(result.candidateId).toBe('pc1');
  });
});

describe('GenerateProjectTasks', () => {
  it('should generate default tasks', async () => {
    const useCase = new GenerateProjectTasks();
    const result = await useCase.execute({ projectId: 'p1' });
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks[0].title).toBeDefined();
  });
});

describe('RequestExternalActionApproval', () => {
  it('should create approval request', async () => {
    const useCase = new RequestExternalActionApproval();
    const result = await useCase.execute({
      projectId: 'p1',
      actionType: 'email_send',
      description: 'Send proposal to client',
      requestedBy: 'user1',
    });
    expect(result.status).toBe('pending');
    expect(result.approvalId).toBeDefined();
  });
});

describe('ApproveAction', () => {
  it('should approve action', async () => {
    const useCase = new ApproveAction();
    const result = await useCase.execute({
      approvalId: 'a1',
      decision: 'approve',
      actor: 'manager1',
    });
    expect(result.decision).toBe('approve');
    expect(result.decidedAt).toBeInstanceOf(Date);
  });

  it('should reject action', async () => {
    const useCase = new ApproveAction();
    const result = await useCase.execute({
      approvalId: 'a1',
      decision: 'reject',
      actor: 'manager1',
      reason: 'Budget exceeded',
    });
    expect(result.decision).toBe('reject');
  });
});
