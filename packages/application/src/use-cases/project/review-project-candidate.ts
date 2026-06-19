import type { UseCase } from '../index.js';
import type { ProjectCandidateRepository } from '../../ports/index.js';

export interface ReviewProjectCandidateInput {
  candidateId: string;
  action: 'approve' | 'reject' | 'request_review';
  reason?: string;
}

export interface ReviewProjectCandidateOutput {
  candidateId: string;
  status: string;
}

/**
 * ReviewProjectCandidate
 * Reviews a project candidate and updates its status.
 * Enforces valid state transitions.
 */
export class ReviewProjectCandidate implements UseCase<ReviewProjectCandidateInput, ReviewProjectCandidateOutput> {
  constructor(private readonly candidateRepo: ProjectCandidateRepository) {}

  async execute(input: ReviewProjectCandidateInput): Promise<ReviewProjectCandidateOutput> {
    const candidate = await this.candidateRepo.findById(input.candidateId);
    if (!candidate) {
      throw new Error(`Project candidate ${input.candidateId} not found`);
    }

    switch (input.action) {
      case 'approve':
        candidate.approve();
        break;
      case 'reject':
        candidate.reject();
        break;
      case 'request_review':
        candidate.requestReview();
        break;
    }

    await this.candidateRepo.save(candidate);

    return {
      candidateId: input.candidateId,
      status: candidate.status,
    };
  }
}
