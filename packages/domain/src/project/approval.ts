import { BaseEntity } from '../entities/index.js';

export type ApprovalType = 'general' | 'external_send' | 'budget';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * ApprovalRequest — request for approval on a project action.
 */
export class ApprovalRequest extends BaseEntity<string> {
  private _status: ApprovalStatus;
  private _decidedAt: Date | null = null;
  private _decidedBy: string | null = null;

  constructor(
    id: string,
    public readonly projectId: string,
    public readonly type: ApprovalType,
    public readonly requestedBy: string,
    status: ApprovalStatus = 'pending',
    public readonly reason: string | null = null,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._status = status;
  }

  get status(): ApprovalStatus {
    return this._status;
  }

  get decidedAt(): Date | null {
    return this._decidedAt;
  }

  get decidedBy(): string | null {
    return this._decidedBy;
  }

  approve(actor: string): ApprovalDecision {
    if (this._status !== 'pending') {
      throw new Error(`Cannot approve request in status ${this._status}`);
    }
    this._status = 'approved';
    this._decidedAt = new Date();
    this._decidedBy = actor;
    return { requestId: this.id, decision: 'approved', actor, decidedAt: this._decidedAt };
  }

  reject(actor: string, reason: string): ApprovalDecision {
    if (this._status !== 'pending') {
      throw new Error(`Cannot reject request in status ${this._status}`);
    }
    this._status = 'rejected';
    this._decidedAt = new Date();
    this._decidedBy = actor;
    return { requestId: this.id, decision: 'rejected', actor, decidedAt: this._decidedAt, reason };
  }
}

export interface ApprovalDecision {
  requestId: string;
  decision: 'approved' | 'rejected';
  actor: string;
  decidedAt: Date;
  reason?: string;
}
