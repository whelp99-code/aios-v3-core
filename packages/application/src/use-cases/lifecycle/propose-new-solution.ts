
import type { UseCase } from '../index.js';
import { DecimalMoney, SolutionProposal } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository } from '../../ports/index.js';

export interface ProposeNewSolutionInput {
  customerId: string;
  description: string;
  sourceEvidence: string[];
  estimatedValue?: number;
  currency?: string;
}

export interface ProposeNewSolutionOutput {
  solutionId: string;
  status: 'proposed';
}

/**
 * ProposeNewSolution
 * Proposes a new solution based on improvement items or customer feedback.
 */
export class ProposeNewSolution implements UseCase<ProposeNewSolutionInput, ProposeNewSolutionOutput> {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: ProposeNewSolutionInput): Promise<ProposeNewSolutionOutput> {
    if (!await this.customerRepo.findById(input.customerId)) throw new Error(`Customer ${input.customerId} not found`);
    if (input.sourceEvidence.length === 0) throw new Error('Solution proposal requires source evidence');
    const proposal = new SolutionProposal(
      globalThis.crypto.randomUUID(), input.customerId, input.description,
      input.sourceEvidence,
      input.estimatedValue === undefined
        ? null
        : DecimalMoney.from(input.estimatedValue, input.currency ?? 'KRW')
    );
    await this.lifecycleRepo.saveSolutionProposal(proposal);
    return {
      solutionId: proposal.id,
      status: 'proposed',
    };
  }
}
