
import type { UseCase } from '../index.js';

export interface ProposeNewSolutionInput {
  customerId: string;
  description: string;
  sourceEvidence: string[];
  estimatedValue?: number;
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
  async execute(_input: ProposeNewSolutionInput): Promise<ProposeNewSolutionOutput> {
    return {
      solutionId: globalThis.crypto.randomUUID(),
      status: 'proposed',
    };
  }
}
