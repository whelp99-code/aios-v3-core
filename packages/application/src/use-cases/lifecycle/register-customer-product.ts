
import type { UseCase } from '../index.js';
import { CustomerProduct } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository, ProjectRepository } from '../../ports/index.js';

export interface RegisterCustomerProductInput {
  customerId: string;
  projectId: string;
  projectName: string;
  productName: string;
  version: string;
  installationDate: Date;
}

export interface RegisterCustomerProductOutput {
  productId: string;
  customerId: string;
}

/**
 * RegisterCustomerProduct
 * Registers a delivered product for a customer.
 */
export class RegisterCustomerProduct implements UseCase<RegisterCustomerProductInput, RegisterCustomerProductOutput> {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: RegisterCustomerProductInput): Promise<RegisterCustomerProductOutput> {
    if (!await this.customerRepo.findById(input.customerId)) throw new Error(`Customer ${input.customerId} not found`);
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new Error(`Project ${input.projectId} not found`);
    if (project.status !== 'completed') throw new Error('Product registration requires a completed project');
    if (project.customerId !== input.customerId) {
      throw new Error(`Project ${input.projectId} does not belong to customer ${input.customerId}`);
    }
    const product = new CustomerProduct(
      globalThis.crypto.randomUUID(), input.customerId, input.projectId,
      input.productName, input.version, input.installationDate
    );
    const persisted = await this.lifecycleRepo.saveCustomerProduct(product);
    return {
      productId: persisted.id,
      customerId: input.customerId,
    };
  }
}
