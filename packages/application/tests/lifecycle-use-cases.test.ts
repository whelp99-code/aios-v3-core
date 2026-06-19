import { describe, it, expect } from 'vitest';
import {
  CompleteProject,
  PrepareCfoHandoff,
  RegisterCustomerProduct,
  OpenMaintenanceCase,
  ProposeNewSolution
} from '../src/use-cases/lifecycle/index.js';

describe('CompleteProject', () => {
  it('should complete project and trigger CFO handoff', async () => {
    const useCase = new CompleteProject();
    const result = await useCase.execute({ projectId: 'p1' });
    expect(result.status).toBe('completed');
    expect(result.cfoHandoffDraft).toBe(true);
  });
});

describe('PrepareCfoHandoff', () => {
  it('should calculate totals and require approval', async () => {
    const useCase = new PrepareCfoHandoff();
    const result = await useCase.execute({
      projectId: 'p1',
      projectName: 'Test',
      items: [
        { category: 'Development', description: 'Main dev', amount: 1000000, currency: 'KRW' },
        { category: 'Consulting', description: 'Review', amount: 500000, currency: 'KRW' },
      ],
    });

    expect(result.totalAmount).toBe(1500000);
    expect(result.status).toBe('draft');
    expect(result.approvalRequired).toBe(true);
    expect(result.handoffId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('RegisterCustomerProduct', () => {
  it('should register product for customer', async () => {
    const useCase = new RegisterCustomerProduct();
    const result = await useCase.execute({
      customerId: 'c1',
      projectName: 'AIOS',
      productName: 'AIOS Platform',
      version: '1.0.0',
      installationDate: new Date(),
    });

    expect(result.productId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.customerId).toBe('c1');
  });
});

describe('OpenMaintenanceCase', () => {
  it('should open maintenance case', async () => {
    const useCase = new OpenMaintenanceCase();
    const result = await useCase.execute({
      customerId: 'c1',
      productId: 'prod1',
      description: 'System update needed',
      priority: 'medium',
    });

    expect(result.status).toBe('open');
    expect(result.caseId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('ProposeNewSolution', () => {
  it('should propose solution with evidence', async () => {
    const useCase = new ProposeNewSolution();
    const result = await useCase.execute({
      customerId: 'c1',
      description: 'AI-based automation',
      sourceEvidence: ['maintenance-case-1', 'customer-feedback-2'],
    });

    expect(result.status).toBe('proposed');
    expect(result.solutionId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
