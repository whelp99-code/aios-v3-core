import { describe, it, expect } from 'vitest';
import { Project, ProjectCandidate, TaskCard, ApprovalRequest, ConfidenceScore } from '../src/index.js';

describe('Project', () => {
  it('should create with candidate status', () => {
    const project = new Project('p1', 'Test Project', 'c1', 'pc1');
    expect(project.status).toBe('candidate');
  });

  it('should transition through lifecycle', () => {
    const project = new Project('p1', 'Test', null, null);
    project.activate();
    expect(project.status).toBe('active');
    project.complete();
    expect(project.status).toBe('completed');
  });
});

describe('ProjectCandidate', () => {
  it('should create with confidence', () => {
    const candidate = new ProjectCandidate(
      'pc1', 't1', 'c1', new ConfidenceScore(0.85)
    );
    expect(candidate.confidence.value).toBe(0.85);
    expect(candidate.status).toBe('proposed');
  });

  it('should approve and reject', () => {
    const candidate = new ProjectCandidate(
      'pc1', 't1', null, new ConfidenceScore(0.9)
    );
    candidate.approve();
    expect(candidate.status).toBe('approved');
  });
});

describe('TaskCard', () => {
  it('should transition through states', () => {
    const task = new TaskCard('t1', 'p1', 'Do something');
    expect(task.status).toBe('pending');
    task.start();
    expect(task.status).toBe('in_progress');
    task.complete();
    expect(task.status).toBe('done');
  });
});

describe('ApprovalRequest', () => {
  it('should approve with decision', () => {
    const request = new ApprovalRequest('a1', 'p1', 'external_send', 'user1');
    const decision = request.approve('manager1');
    expect(decision.decision).toBe('approved');
    expect(request.status).toBe('approved');
  });

  it('should reject with reason', () => {
    const request = new ApprovalRequest('a1', 'p1', 'budget', 'user1');
    const decision = request.reject('manager1', 'Too expensive');
    expect(decision.decision).toBe('rejected');
    expect(decision.reason).toBe('Too expensive');
    expect(request.reason).toBe('Too expensive');
  });

  it('should hydrate persisted decision metadata', () => {
    const decidedAt = new Date('2026-01-01T00:00:00.000Z');
    const request = new ApprovalRequest(
      'a1',
      'p1',
      'budget',
      'user1',
      'approved',
      'Approved request',
      {},
      'manager1',
      decidedAt
    );

    expect(request.decidedBy).toBe('manager1');
    expect(request.decidedAt).toBe(decidedAt);
  });
});
