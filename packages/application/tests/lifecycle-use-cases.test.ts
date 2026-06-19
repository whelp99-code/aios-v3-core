import { describe, expect, it, vi } from 'vitest';
import { CustomerProduct, Organization, Project } from '@aios/domain';
import type {
  CustomerRepository,
  LifecycleRepository,
  ProjectRepository,
} from '../src/ports/index.js';
import {
  CompleteProject,
  OpenMaintenanceCase,
  PrepareCfoHandoff,
  ProposeNewSolution,
  RegisterCustomerProduct,
} from '../src/use-cases/lifecycle/index.js';

function projectRepo(status: 'active' | 'completed' = 'completed'): ProjectRepository {
  const project = new Project('p1', 'AIOS', 'c1', null, status);
  return {
    save: vi.fn(async (value: Project) => value),
    promoteCandidate: vi.fn(async (value: Project) => value),
    findById: vi.fn(async (id: string) => id === project.id ? project : null),
    findByCandidateId: vi.fn().mockResolvedValue(null),
  };
}

function customerRepo(): CustomerRepository {
  const customer = new Organization('c1', 'Customer', 'customer.test');
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(async (id: string) => id === customer.id ? customer : null),
    findByDomain: vi.fn().mockResolvedValue(customer),
  };
}

function lifecycleRepo(product: CustomerProduct | null = null): LifecycleRepository {
  return {
    saveTasks: vi.fn().mockResolvedValue(undefined),
    saveEstimate: vi.fn().mockResolvedValue(undefined),
    saveProposal: vi.fn().mockResolvedValue(undefined),
    savePocPlan: vi.fn().mockResolvedValue(undefined),
    saveEmailDraft: vi.fn().mockResolvedValue(undefined),
    saveCfoHandoff: vi.fn().mockResolvedValue(undefined),
    saveCustomerProduct: vi.fn(async (value) => value),
    findCustomerProduct: vi.fn().mockResolvedValue(product),
    saveMaintenanceCase: vi.fn().mockResolvedValue(undefined),
    saveSolutionProposal: vi.fn().mockResolvedValue(undefined),
  };
}

describe('persisted lifecycle use cases', () => {
  it('completes an active project', async () => {
    const projects = projectRepo('active');
    const result = await new CompleteProject(projects).execute({ projectId: 'p1' });
    expect(result.status).toBe('completed');
    expect(projects.save).toHaveBeenCalledTimes(1);
  });

  it('creates a decimal CFO handoff draft', async () => {
    const persistence = lifecycleRepo();
    const result = await new PrepareCfoHandoff(projectRepo(), persistence).execute({
      projectId: 'p1', projectName: 'AIOS',
      items: [
        { category: 'Development', description: 'Main', amount: 100.10, currency: 'KRW' },
        { category: 'Review', description: 'QA', amount: 50.05, currency: 'KRW' },
      ],
    });
    expect(result.totalAmount).toBe(150.15);
    expect(result.approvalRequired).toBe(true);
    expect(persistence.saveCfoHandoff).toHaveBeenCalledTimes(1);
  });

  it('registers a delivered product and opens a maintenance case', async () => {
    const persistence = lifecycleRepo();
    const registered = await new RegisterCustomerProduct(
      customerRepo(), projectRepo(), persistence
    ).execute({
      customerId: 'c1', projectId: 'p1', projectName: 'AIOS',
      productName: 'AIOS Platform', version: '1.0.0', installationDate: new Date(),
    });
    const product = new CustomerProduct(registered.productId, 'c1', 'p1', 'AIOS Platform', '1.0.0', new Date());
    const maintenancePersistence = lifecycleRepo(product);
    const maintenance = await new OpenMaintenanceCase(
      customerRepo(), maintenancePersistence
    ).execute({
      customerId: 'c1', productId: product.id,
      description: 'System update', priority: 'medium',
    });

    expect(maintenance.status).toBe('open');
    expect(persistence.saveCustomerProduct).toHaveBeenCalledTimes(1);
    expect(maintenancePersistence.saveMaintenanceCase).toHaveBeenCalledTimes(1);
  });

  it('rejects product registration when the project belongs to another customer', async () => {
    const persistence = lifecycleRepo();
    const otherCustomerProjectRepo: ProjectRepository = {
      save: vi.fn(async (value: Project) => value),
      findById: vi.fn().mockResolvedValue(new Project('p1', 'AIOS', 'c2', null, 'completed')),
      findByCandidateId: vi.fn().mockResolvedValue(null),
    };

    await expect(new RegisterCustomerProduct(
      customerRepo(), otherCustomerProjectRepo, persistence
    ).execute({
      customerId: 'c1', projectId: 'p1', projectName: 'AIOS',
      productName: 'AIOS Platform', version: '1.0.0', installationDate: new Date(),
    })).rejects.toThrow('not found for customer');
    expect(persistence.saveCustomerProduct).not.toHaveBeenCalled();
  });

  it('persists a solution proposal with evidence', async () => {
    const persistence = lifecycleRepo();
    const result = await new ProposeNewSolution(customerRepo(), persistence).execute({
      customerId: 'c1', description: 'AI automation',
      sourceEvidence: ['maintenance-case-1'], estimatedValue: 1000, currency: 'USD',
    });
    expect(result.status).toBe('proposed');
    expect(persistence.saveSolutionProposal).toHaveBeenCalledTimes(1);
  });
});
