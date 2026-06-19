
import type { UseCase } from '../index.js';
import type { ApprovalRepository } from '../../ports/index.js';
import { ApprovalRequest } from '@aios/domain';

export type ExternalActionType = 'email_send' | 'document_share' | 'api_call';

export interface RequestExternalActionApprovalInput {
  projectId: string;
  actionType: ExternalActionType;
  description: string;
  requestedBy: string;
}

export interface RequestExternalActionApprovalOutput {
  approvalId: string;
  status: 'pending';
}

/**
 * RequestExternalActionApproval
 * Creates an approval request for external actions.
 * External actions are ALWAYS blocked until approved.
 */
export class RequestExternalActionApproval implements UseCase<RequestExternalActionApprovalInput, RequestExternalActionApprovalOutput> {
  constructor(private readonly approvalRepo: ApprovalRepository) {}

  async execute(input: RequestExternalActionApprovalInput): Promise<RequestExternalActionApprovalOutput> {
    const approvalId = globalThis.crypto.randomUUID();
    const request = new ApprovalRequest(
      approvalId,
      input.projectId,
      'external_send',
      input.requestedBy,
      'pending',
      input.description
    );

    await this.approvalRepo.save(request);

    return {
      approvalId,
      status: 'pending',
    };
  }
}
