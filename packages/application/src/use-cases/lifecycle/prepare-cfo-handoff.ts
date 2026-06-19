
import type { UseCase } from '../index.js';

export interface CfoHandoffItem {
  category: string;
  description: string;
  amount: number;
  currency: string;
}

export interface PrepareCfoHandoffInput {
  projectId: string;
  projectName: string;
  items: CfoHandoffItem[];
}

export interface PrepareCfoHandoffOutput {
  handoffId: string;
  projectId: string;
  totalAmount: number;
  currency: string;
  status: 'draft';
  approvalRequired: true;
}

/**
 * PrepareCfoHandoff
 * Creates CFO handoff draft for completed project.
 * Internal draft only — external accounting system requires approval.
 */
export class PrepareCfoHandoff implements UseCase<PrepareCfoHandoffInput, PrepareCfoHandoffOutput> {
  async execute(input: PrepareCfoHandoffInput): Promise<PrepareCfoHandoffOutput> {
    const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);

    return {
      handoffId: globalThis.crypto.randomUUID(),
      projectId: input.projectId,
      totalAmount,
      currency: input.items[0]?.currency ?? 'KRW',
      status: 'draft',
      approvalRequired: true,
    };
  }
}
