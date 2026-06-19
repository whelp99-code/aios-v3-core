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
    expect(result.currency).toBe('KRW');
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
    expect(result.status).toBe('draft');
  });

  it('should use UUID for estimate ID', async () => {
    const useCase = new GenerateEstimate();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      customerName: 'Test',
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: 0 }],
    });

    expect(result.estimateId).toBeDefined();
    expect(result.estimateId).not.toContain('estimate-');
    // UUID v4 format
    expect(result.estimateId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should reject mixed currencies', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [
          { description: 'A', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: 0 },
          { description: 'B', quantity: 1, unitPrice: 100, currency: 'USD', taxRate: 0 },
        ],
      })
    ).rejects.toThrow('Mixed currencies not allowed');
  });

  it('should reject negative quantity', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: -1, unitPrice: 100, currency: 'KRW', taxRate: 0 }],
      })
    ).rejects.toThrow('Invalid quantity');
  });

  it('should reject negative unitPrice', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: 1, unitPrice: -100, currency: 'KRW', taxRate: 0 }],
      })
    ).rejects.toThrow('Invalid unitPrice');
  });

  it('should reject NaN quantity', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: NaN, unitPrice: 100, currency: 'KRW', taxRate: 0 }],
      })
    ).rejects.toThrow('Invalid quantity');
  });

  it('should reject NaN unitPrice', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: 1, unitPrice: NaN, currency: 'KRW', taxRate: 0 }],
      })
    ).rejects.toThrow('Invalid unitPrice');
  });

  it('should reject negative taxRate', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: -5 }],
      })
    ).rejects.toThrow('Invalid taxRate');
  });

  it('should reject NaN taxRate', async () => {
    const useCase = new GenerateEstimate();

    await expect(
      useCase.execute({
        projectId: 'p1',
        projectName: 'Test',
        customerName: 'Test',
        items: [{ description: 'Bad', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: NaN }],
      })
    ).rejects.toThrow('Invalid taxRate');
  });
});

describe('GenerateProposal', () => {
  it('should create proposal draft with UUID', async () => {
    const useCase = new GenerateProposal();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      customerName: 'Test Corp',
      sections: [{ title: 'Overview', content: 'Project overview' }],
    });

    expect(result.proposalId).toBeDefined();
    expect(result.proposalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.status).toBe('draft');
  });
});

describe('GeneratePocPlan', () => {
  it('should create POC plan draft with UUID', async () => {
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
    expect(result.pocPlanId).toMatch(/^[0-9a-f-]{36}$/);
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
    expect(result.draftId).toMatch(/^[0-9a-f-]{36}$/);
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

    expect(result.status).toBe('draft');
    expect(result.approvalRequired).toBe(true);
  });
});
