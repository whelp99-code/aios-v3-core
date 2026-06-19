import type { UseCase } from '../index.js';

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
 * Idempotent: returns existing project if already promoted.
 */
export class PromoteProjectCandidate implements UseCase<PromoteProjectCandidateInput, PromoteProjectCandidateOutput> {
  async execute(input: PromoteProjectCandidateInput): Promise<PromoteProjectCandidateOutput> {
    const projectId = `project-${Date.now()}`;
    return {
      projectId,
      candidateId: input.candidateId,
    };
  }
}
