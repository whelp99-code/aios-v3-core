import type { UseCase } from '../index.js';

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
 * Processes an approval decision.
 */
export class ApproveAction implements UseCase<ApproveActionInput, ApproveActionOutput> {
  async execute(input: ApproveActionInput): Promise<ApproveActionOutput> {
    return {
      approvalId: input.approvalId,
      decision: input.decision,
      decidedAt: new Date(),
    };
  }
}
