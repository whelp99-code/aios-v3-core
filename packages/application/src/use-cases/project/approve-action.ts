
import type { UseCase } from '../index.js';
import type { ApprovalActor, ApprovalRepository } from '../../ports/index.js';

export interface ApproveActionInput {
  approvalId: string;
  decision: 'approve' | 'reject';
  actor: ApprovalActor;
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

    if (!input.actor.roles.some((role) => role === 'approver' || role === 'admin')) {
      throw new Error(`Actor ${input.actor.id} is not authorized to decide approvals`);
    }

    if (request.requestedBy === input.actor.id) {
      throw new Error(
        `Actor ${input.actor.id} cannot decide their own approval request`
      );
    }

    if (input.decision === 'reject' && !input.reason?.trim()) {
      throw new Error('A rejection reason is required');
    }

    const decidedAt = new Date();
    const decided = await this.approvalRepo.decidePending({
      approvalId: input.approvalId,
      decision: input.decision === 'approve' ? 'approved' : 'rejected',
      actorId: input.actor.id,
      reason: input.reason,
      decidedAt,
    });

    if (!decided) {
      throw new Error(`Approval request ${input.approvalId} was decided concurrently`);
    }

    return {
      approvalId: decided.id,
      decision: decided.status,
      decidedAt: decided.decidedAt ?? decidedAt,
    };
  }
}
