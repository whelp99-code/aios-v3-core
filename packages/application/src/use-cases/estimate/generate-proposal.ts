import type { UseCase } from '../index.js';

export interface GenerateProposalInput {
  projectId: string;
  projectName: string;
  customerName: string;
  sections: Array<{ title: string; content: string }>;
}

export interface GenerateProposalOutput {
  proposalId: string;
  status: 'draft';
}

/**
 * GenerateProposal
 * Creates a proposal draft.
 */
export class GenerateProposal implements UseCase<GenerateProposalInput, GenerateProposalOutput> {
  async execute(input: GenerateProposalInput): Promise<GenerateProposalOutput> {
    return {
      proposalId: `proposal-${Date.now()}`,
      status: 'draft',
    };
  }
}
