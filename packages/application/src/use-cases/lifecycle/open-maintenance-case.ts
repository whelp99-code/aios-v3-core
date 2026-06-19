
import type { UseCase } from '../index.js';
import { MaintenanceCase } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository } from '../../ports/index.js';

export interface OpenMaintenanceCaseInput {
  customerId: string;
  productId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OpenMaintenanceCaseOutput {
  caseId: string;
  status: 'open';
}

/**
 * OpenMaintenanceCase
 * Opens a maintenance case for a customer product.
 */
export class OpenMaintenanceCase implements UseCase<OpenMaintenanceCaseInput, OpenMaintenanceCaseOutput> {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: OpenMaintenanceCaseInput): Promise<OpenMaintenanceCaseOutput> {
    if (!await this.customerRepo.findById(input.customerId)) throw new Error(`Customer ${input.customerId} not found`);
    const product = await this.lifecycleRepo.findCustomerProduct(input.productId);
    if (!product || product.customerId !== input.customerId) {
      throw new Error(`Product ${input.productId} not found for customer ${input.customerId}`);
    }
    if (product.status !== 'active') throw new Error(`Product ${input.productId} is not active`);
    const maintenanceCase = new MaintenanceCase(
      globalThis.crypto.randomUUID(), input.customerId, input.productId,
      input.description, input.priority
    );
    await this.lifecycleRepo.saveMaintenanceCase(maintenanceCase);
    return {
      caseId: maintenanceCase.id,
      status: 'open',
    };
  }
}
