
import type { UseCase } from '../index.js';
import { CfoHandoffDraft, DecimalMoney } from '@aios/domain';
import type { LifecycleRepository, ProjectRepository } from '../../ports/index.js';

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
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: PrepareCfoHandoffInput): Promise<PrepareCfoHandoffOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new Error(`Project ${input.projectId} not found`);
    if (project.status !== 'completed') throw new Error('CFO handoff requires a completed project');
    if (input.items.length === 0) throw new Error('CFO handoff requires at least one item');
    const currencies = new Set(input.items.map((item) => item.currency.trim().toUpperCase()));
    if (currencies.has('')) throw new Error('Currency is required');
    if (currencies.size !== 1) throw new Error('Mixed currencies not allowed in CFO handoff');
    const currency = input.items[0].currency.trim().toUpperCase();
    let total = DecimalMoney.zero(currency);
    for (const item of input.items) total = total.add(DecimalMoney.from(item.amount, currency));
    const handoff = new CfoHandoffDraft(
      globalThis.crypto.randomUUID(), input.projectId, input.items, total
    );
    await this.lifecycleRepo.saveCfoHandoff(handoff);

    return {
      handoffId: handoff.id,
      projectId: input.projectId,
      totalAmount: total.toNumber(),
      currency,
      status: 'draft',
      approvalRequired: true,
    };
  }
}
