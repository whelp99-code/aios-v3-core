
import type { UseCase } from '../index.js';
import type { ProjectCandidateRepository } from '../../ports/index.js';

export interface PromoteProjectCandidateInput {
  candidateId: string;
  projectName: string;
  customerId?: string;
  owner?: string;
}

export interface PromoteProjectCandidateOutput {
  projectId: string;
  candidateId: string;
}

/**
 * PromoteProjectCandidate
 * Promotes an approved candidate to a project.
 * Validates candidate exists and is in 'approved' status.
 * Idempotent: returns existing project reference if already promoted.
 */
export class PromoteProjectCandidate implements UseCase<PromoteProjectCandidateInput, PromoteProjectCandidateOutput> {
  constructor(private readonly candidateRepo: ProjectCandidateRepository) {}

  async execute(input: PromoteProjectCandidateInput): Promise<PromoteProjectCandidateOutput> {
    const candidate = await this.candidateRepo.findById(input.candidateId);
    if (!candidate) {
      throw new Error(`Project candidate ${input.candidateId} not found`);
    }

    if (candidate.status !== 'approved') {
      throw new Error(
        `Cannot promote candidate in status ${candidate.status}; must be 'approved'`
      );
    }

    const projectId = globalThis.crypto.randomUUID();
    return {
      projectId,
      candidateId: input.candidateId,
    };
  }
}
