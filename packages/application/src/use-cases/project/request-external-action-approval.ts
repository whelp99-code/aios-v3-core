
import type { UseCase } from '../index.js';
import type { ApprovalRepository, ProjectRepository } from '../../ports/index.js';
import { ApprovalRequest, type ExternalActionType } from '@aios/domain';
import { hashApprovalPayload } from '../../security/payload-hash.js';
import { requireProjectInStatus } from '../../validation/lifecycle-state.js';

export type { ExternalActionType } from '@aios/domain';

export interface RequestExternalActionApprovalInput {
  projectId: string;
  actionType: ExternalActionType;
  target: string;
  payload: Record<string, unknown>;
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
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly approvalRepo: ApprovalRepository
  ) {}

  async execute(input: RequestExternalActionApprovalInput): Promise<RequestExternalActionApprovalOutput> {
    await requireProjectInStatus(
      this.projectRepo,
      input.projectId,
      ['candidate', 'active', 'completed']
    );
    const approvalId = globalThis.crypto.randomUUID();
    const payloadHash = await hashApprovalPayload(input.payload);
    const request = new ApprovalRequest(
      approvalId,
      input.projectId,
      'external_send',
      input.requestedBy,
      'pending',
      input.description,
      {},
      null,
      null,
      {
        type: input.actionType,
        target: input.target,
        payload: input.payload,
        payloadHash,
      }
    );

    await this.approvalRepo.save(request);

    return {
      approvalId,
      status: 'pending',
    };
  }
}
