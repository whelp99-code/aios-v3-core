
import type { UseCase } from '../index.js';
import type { EstimateLineItem } from '@aios/domain';
import { DecimalMoney, EstimateDraft } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository, ProjectRepository } from '../../ports/index.js';
import { requireProjectCustomer, requireProjectInStatus } from '../../validation/lifecycle-state.js';

export interface GenerateEstimateInput {
  projectId: string;
  projectName: string;
  customerName: string;
  items: EstimateLineItem[];
  validDays?: number;
}

export interface GenerateEstimateOutput {
  estimateId: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: 'draft';
}

/**
 * GenerateEstimate
 * Creates an estimate draft from project requirements.
 * Validates: single currency, non-negative amounts, no NaN.
 * Status is always 'draft' until approved.
 */
export class GenerateEstimate implements UseCase<GenerateEstimateInput, GenerateEstimateOutput> {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: GenerateEstimateInput): Promise<GenerateEstimateOutput> {
    const project = await requireProjectInStatus(this.projectRepo, input.projectId, ['candidate', 'active']);
    await requireProjectCustomer(project, this.customerRepo);
    if (input.items.length === 0) throw new Error('Estimate requires at least one line item');

    // Validate single currency
    const currencies = new Set(input.items.map((item) => item.currency.trim().toUpperCase()));
    if (currencies.has('')) throw new Error('Currency is required');
    if (currencies.size > 1) {
      throw new Error(
        `Mixed currencies not allowed: ${[...currencies].join(', ')}`
      );
    }

    // Validate each item
    for (const item of input.items) {
      if (item.quantity < 0 || !Number.isFinite(item.quantity)) {
        throw new Error(`Invalid quantity: ${item.quantity}`);
      }
      if (item.unitPrice < 0 || !Number.isFinite(item.unitPrice)) {
        throw new Error(`Invalid unitPrice: ${item.unitPrice}`);
      }
      if (!Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100) {
        throw new Error(`Invalid taxRate: ${item.taxRate}`);
      }
    }

    const currency = input.items[0].currency.trim().toUpperCase();
    let subtotal = DecimalMoney.zero(currency);
    let tax = DecimalMoney.zero(currency);
    for (const item of input.items) {
      const lineTotal = DecimalMoney.from(item.unitPrice, currency).multiply(item.quantity);
      subtotal = subtotal.add(lineTotal);
      tax = tax.add(lineTotal.percentage(item.taxRate));
    }
    const total = subtotal.add(tax);
    const validDays = input.validDays ?? 30;
    if (!Number.isInteger(validDays) || validDays <= 0) throw new Error('validDays must be a positive integer');
    const validUntil = new Date();
    validUntil.setUTCDate(validUntil.getUTCDate() + validDays);
    const estimate = new EstimateDraft(
      globalThis.crypto.randomUUID(),
      input.projectId,
      input.projectName,
      input.customerName,
      input.items,
      subtotal,
      tax,
      total,
      validUntil
    );
    await this.lifecycleRepo.saveEstimate(estimate);

    return {
      estimateId: estimate.id,
      subtotal: subtotal.toNumber(),
      tax: tax.toNumber(),
      total: total.toNumber(),
      currency,
      status: 'draft',
    };
  }
}
