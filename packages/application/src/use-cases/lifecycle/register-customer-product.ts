
import type { UseCase } from '../index.js';

export interface RegisterCustomerProductInput {
  customerId: string;
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
  async execute(input: RegisterCustomerProductInput): Promise<RegisterCustomerProductOutput> {
    return {
      productId: globalThis.crypto.randomUUID(),
      customerId: input.customerId,
    };
  }
}
