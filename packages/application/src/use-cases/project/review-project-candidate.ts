import type { UseCase } from '../index.js';

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
 */
export class ReviewProjectCandidate implements UseCase<ReviewProjectCandidateInput, ReviewProjectCandidateOutput> {
  async execute(input: ReviewProjectCandidateInput): Promise<ReviewProjectCandidateOutput> {
    // Will be implemented with repository
    return {
      candidateId: input.candidateId,
      status: input.action === 'approve' ? 'approved' :
              input.action === 'reject' ? 'rejected' : 'needs_review',
    };
  }
}
