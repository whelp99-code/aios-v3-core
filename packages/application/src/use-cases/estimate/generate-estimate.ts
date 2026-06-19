
import type { UseCase } from '../index.js';
import type { EstimateLineItem } from '@aios/domain';

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
  async execute(input: GenerateEstimateInput): Promise<GenerateEstimateOutput> {
    if (input.items.length === 0) {
      return {
        estimateId: globalThis.crypto.randomUUID(),
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: 'KRW',
        status: 'draft',
      };
    }

    // Validate single currency
    const currencies = new Set(input.items.map((i) => i.currency));
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
      if (!Number.isFinite(item.taxRate) || item.taxRate < 0) {
        throw new Error(`Invalid taxRate: ${item.taxRate}`);
      }
    }

    const { subtotal, tax, total } = input.items.reduce(
      (acc, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = itemTotal * (item.taxRate / 100);
        return {
          subtotal: acc.subtotal + itemTotal,
          tax: acc.tax + itemTax,
          total: acc.total + itemTotal + itemTax,
        };
      },
      { subtotal: 0, tax: 0, total: 0 }
    );

    return {
      estimateId: globalThis.crypto.randomUUID(),
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
      currency: input.items[0].currency,
      status: 'draft',
    };
  }
}
