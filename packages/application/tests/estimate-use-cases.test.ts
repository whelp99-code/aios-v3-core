import { describe, expect, it, vi } from 'vitest';
import { Organization, Project } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository, ProjectRepository } from '../src/ports/index.js';
import {
  GenerateCustomerEmail,
  GenerateEstimate,
  GeneratePocPlan,
  GenerateProposal,
} from '../src/use-cases/estimate/index.js';

function projectRepo(status: 'candidate' | 'active' | 'completed' | 'rejected' = 'active'): ProjectRepository {
  const project = new Project('p1', 'Test Project', 'c1', null, status);
  return {
    save: vi.fn(async (value: Project) => value),
    promoteCandidate: vi.fn(async (value: Project) => value),
    findById: vi.fn(async (id: string) => id === project.id ? project : null),
    findByCandidateId: vi.fn().mockResolvedValue(null),
  };
}

function customerRepo(found = true): CustomerRepository {
  const customer = new Organization('c1', 'Test Corp', 'test.com');
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(async (id: string) => found && id === customer.id ? customer : null),
    findByDomain: vi.fn().mockResolvedValue(customer),
  };
}

function lifecycleRepo(): LifecycleRepository {
  return {
    saveTasks: vi.fn().mockResolvedValue(undefined),
    saveEstimate: vi.fn().mockResolvedValue(undefined),
    saveProposal: vi.fn().mockResolvedValue(undefined),
    savePocPlan: vi.fn().mockResolvedValue(undefined),
    saveEmailDraft: vi.fn().mockResolvedValue(undefined),
    saveCfoHandoff: vi.fn().mockResolvedValue(undefined),
    saveCustomerProduct: vi.fn(async (product) => product),
    findCustomerProduct: vi.fn().mockResolvedValue(null),
    saveMaintenanceCase: vi.fn().mockResolvedValue(undefined),
    saveSolutionProposal: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GenerateEstimate', () => {
  it('calculates decimal totals and persists a draft', async () => {
    const persistence = lifecycleRepo();
    const result = await new GenerateEstimate(projectRepo(), customerRepo(), persistence).execute({
      projectId: 'p1', projectName: 'Test Project', customerName: 'Test Corp',
      items: [
        { description: 'Development', quantity: 1.5, unitPrice: 100.10, currency: 'KRW', taxRate: 10 },
        { description: 'Consulting', quantity: 2, unitPrice: 50.05, currency: 'KRW', taxRate: 10 },
      ],
    });

    expect(result).toMatchObject({ subtotal: 250.25, tax: 25.025, total: 275.275, currency: 'KRW' });
    expect(persistence.saveEstimate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['empty items', [], 'at least one line item'],
    ['mixed currencies', [
      { description: 'A', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: 0 },
      { description: 'B', quantity: 1, unitPrice: 100, currency: 'USD', taxRate: 0 },
    ], 'Mixed currencies'],
    ['negative quantity', [{ description: 'A', quantity: -1, unitPrice: 100, currency: 'KRW', taxRate: 0 }], 'Invalid quantity'],
    ['NaN price', [{ description: 'A', quantity: 1, unitPrice: NaN, currency: 'KRW', taxRate: 0 }], 'Invalid unitPrice'],
    ['tax above 100', [{ description: 'A', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: 101 }], 'Invalid taxRate'],
    ['empty currency', [{ description: 'A', quantity: 1, unitPrice: 100, currency: ' ', taxRate: 0 }], 'Currency is required'],
  ])('rejects %s', async (_name, items, message) => {
    await expect(new GenerateEstimate(projectRepo(), customerRepo(), lifecycleRepo()).execute({
      projectId: 'p1', projectName: 'Test', customerName: 'Test', items,
    })).rejects.toThrow(message);
  });

  it('rejects closed projects and missing project customers', async () => {
    const input = {
      projectId: 'p1', projectName: 'Test', customerName: 'Test',
      items: [{ description: 'A', quantity: 1, unitPrice: 100, currency: 'KRW', taxRate: 0 }],
    };
    await expect(new GenerateEstimate(
      projectRepo('completed'), customerRepo(), lifecycleRepo()
    ).execute(input)).rejects.toThrow('status completed');
    await expect(new GenerateEstimate(
      projectRepo(), customerRepo(false), lifecycleRepo()
    ).execute(input)).rejects.toThrow('Customer for project');
  });
});

describe('document drafts', () => {
  it('persists proposal and POC drafts', async () => {
    const persistence = lifecycleRepo();
    const proposal = await new GenerateProposal(projectRepo(), customerRepo(), persistence).execute({
      projectId: 'p1', projectName: 'Test', customerName: 'Test Corp',
      sections: [{ title: 'Overview', content: 'Project overview' }],
    });
    const poc = await new GeneratePocPlan(projectRepo(), persistence).execute({
      projectId: 'p1', projectName: 'Test', objectives: ['Verify'], scope: 'Limited',
      timeline: [{ phase: 'Phase 1', duration: '2 weeks' }], successCriteria: ['Pass'],
    });

    expect(proposal.status).toBe('draft');
    expect(poc.status).toBe('draft');
    expect(persistence.saveProposal).toHaveBeenCalledTimes(1);
    expect(persistence.savePocPlan).toHaveBeenCalledTimes(1);
  });

  it('persists an email draft without sending it', async () => {
    const persistence = lifecycleRepo();
    const result = await new GenerateCustomerEmail(projectRepo(), customerRepo(), persistence).execute({
      projectId: 'p1', projectName: 'AIOS', customerName: 'Test Corp',
      recipientEmail: 'contact@test.com', purpose: 'estimate',
    });

    expect(result).toMatchObject({ status: 'draft', approvalRequired: true });
    expect(persistence.saveEmailDraft).toHaveBeenCalledTimes(1);
  });
});
