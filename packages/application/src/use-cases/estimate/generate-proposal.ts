
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
  async execute(_input: GenerateProposalInput): Promise<GenerateProposalOutput> {
    return {
      proposalId: globalThis.crypto.randomUUID(),
      status: 'draft',
    };
  }
}
