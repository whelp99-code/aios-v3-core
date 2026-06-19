
import type { UseCase } from '../index.js';
import { ProposalDraft } from '@aios/domain';
import type { CustomerRepository, LifecycleRepository, ProjectRepository } from '../../ports/index.js';
import { requireProjectCustomer, requireProjectInStatus } from '../../validation/lifecycle-state.js';

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
    private readonly customerRepo: CustomerRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: GenerateProposalInput): Promise<GenerateProposalOutput> {
    const project = await requireProjectInStatus(this.projectRepo, input.projectId, ['candidate', 'active']);
    await requireProjectCustomer(project, this.customerRepo);
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
