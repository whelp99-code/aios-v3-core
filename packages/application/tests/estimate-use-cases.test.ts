import { describe, it, expect } from 'vitest';
import {
  GenerateEstimate,
  GenerateProposal,
  GeneratePocPlan,
  GenerateCustomerEmail
} from '../src/use-cases/estimate/index.js';

describe('GenerateEstimate', () => {
  it('should calculate estimate totals', async () => {
    const useCase = new GenerateEstimate();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test Project',
      customerName: 'Test Corp',
      items: [
        { description: 'Development', quantity: 1, unitPrice: 1000000, currency: 'KRW', taxRate: 10 },
        { description: 'Consulting', quantity: 2, unitPrice: 500000, currency: 'KRW', taxRate: 10 },
      ],
    });

    expect(result.subtotal).toBe(2000000);
    expect(result.tax).toBe(200000);
    expect(result.total).toBe(2200000);
    expect(result.status).toBe('draft');
  });

  it('should handle empty items', async () => {
    const useCase = new GenerateEstimate();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      customerName: 'Test',
      items: [],
    });

    expect(result.total).toBe(0);
  });
});

describe('GenerateProposal', () => {
  it('should create proposal draft', async () => {
    const useCase = new GenerateProposal();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      customerName: 'Test Corp',
      sections: [{ title: 'Overview', content: 'Project overview' }],
    });

    expect(result.proposalId).toBeDefined();
    expect(result.status).toBe('draft');
  });
});

describe('GeneratePocPlan', () => {
  it('should create POC plan draft', async () => {
    const useCase = new GeneratePocPlan();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      objectives: ['Verify feasibility'],
      scope: 'Limited scope',
      timeline: [{ phase: 'Phase 1', duration: '2 weeks' }],
      successCriteria: ['All tests pass'],
    });

    expect(result.pocPlanId).toBeDefined();
    expect(result.status).toBe('draft');
  });
});

describe('GenerateCustomerEmail', () => {
  it('should create email draft with approval required', async () => {
    const useCase = new GenerateCustomerEmail();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'AIOS Project',
      customerName: 'Test Corp',
      recipientEmail: 'contact@test.com',
      purpose: 'estimate',
    });

    expect(result.status).toBe('draft');
    expect(result.approvalRequired).toBe(true);
    expect(result.subject).toContain('AIOS Project');
    expect(result.body).toContain('Test Corp');
  });

  it('should never send email directly', async () => {
    const useCase = new GenerateCustomerEmail();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      customerName: 'Test',
      recipientEmail: 'test@test.com',
      purpose: 'follow_up',
      customMessage: 'Please review.',
    });

    // Always draft, never sent
    expect(result.status).toBe('draft');
    expect(result.approvalRequired).toBe(true);
  });
});
