import type { UseCase } from '../index.js';

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
  async execute(input: RequestExternalActionApprovalInput): Promise<RequestExternalActionApprovalOutput> {
    const approvalId = `approval-${Date.now()}`;
    return {
      approvalId,
      status: 'pending',
    };
  }
}
