
import type { UseCase } from '../index.js';
import type { ApprovalRepository } from '../../ports/index.js';

export interface ApproveActionInput {
  approvalId: string;
  decision: 'approve' | 'reject';
  actor: string;
  reason?: string;
}

export interface ApproveActionOutput {
  approvalId: string;
  decision: string;
  decidedAt: Date;
}

/**
 * ApproveAction
 * Processes an approval decision with full enforcement:
 * - Only pending requests can be decided
 * - requestedBy ≠ decidedBy (no self-approval)
 * - No duplicate decisions
 */
export class ApproveAction implements UseCase<ApproveActionInput, ApproveActionOutput> {
  constructor(private readonly approvalRepo: ApprovalRepository) {}

  async execute(input: ApproveActionInput): Promise<ApproveActionOutput> {
    const request = await this.approvalRepo.findById(input.approvalId);
    if (!request) {
      throw new Error(`Approval request ${input.approvalId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(
        `Approval request ${input.approvalId} is already ${request.status}`
      );
    }

    if (request.requestedBy === input.actor) {
      throw new Error(
        `Actor ${input.actor} cannot decide their own approval request`
      );
    }

    let decision;
    if (input.decision === 'approve') {
      decision = request.approve(input.actor);
    } else {
      decision = request.reject(input.actor, input.reason ?? 'No reason provided');
    }

    await this.approvalRepo.save(request);

    return {
      approvalId: request.id,
      decision: decision.decision,
      decidedAt: decision.decidedAt,
    };
  }
}
