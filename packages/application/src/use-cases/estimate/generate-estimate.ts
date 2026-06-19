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
 * Status is always 'draft' until approved.
 */
export class GenerateEstimate implements UseCase<GenerateEstimateInput, GenerateEstimateOutput> {
  async execute(input: GenerateEstimateInput): Promise<GenerateEstimateOutput> {
    // Calculate totals using domain rules
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
      estimateId: `estimate-${Date.now()}`,
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      total: Math.round(total),
      currency: input.items[0]?.currency ?? 'KRW',
      status: 'draft',
    };
  }
}
