
import type { UseCase } from '../index.js';
import { ProposalDraft } from '@aios/domain';
import type { LifecycleRepository, ProjectRepository } from '../../ports/index.js';

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
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: GenerateProposalInput): Promise<GenerateProposalOutput> {
    if (!await this.projectRepo.findById(input.projectId)) throw new Error(`Project ${input.projectId} not found`);
    if (input.sections.length === 0) throw new Error('Proposal requires at least one section');
    const proposal = new ProposalDraft(
      globalThis.crypto.randomUUID(), input.projectId, input.projectName,
      input.customerName, input.sections
    );
    await this.lifecycleRepo.saveProposal(proposal);
    return {
      proposalId: proposal.id,
      status: 'draft',
    };
  }
}
