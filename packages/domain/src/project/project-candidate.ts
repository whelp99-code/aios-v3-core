import { BaseEntity } from '../entities/index.js';
import { ConfidenceScore } from './confidence-score.js';

export type CandidateStatus = 'proposed' | 'needs_review' | 'approved' | 'rejected';

/**
 * ProjectCandidate — a proposed project from mail analysis.
 */
export class ProjectCandidate extends BaseEntity<string> {
  private _status: CandidateStatus;

  constructor(
    id: string,
    public readonly threadId: string,
    public readonly customerId: string | null,
    public readonly confidence: ConfidenceScore,
    status: CandidateStatus = 'proposed',
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._status = status;
  }

  get status(): CandidateStatus {
    return this._status;
  }

  approve(): void {
    if (this._status === 'rejected') {
      throw new Error('Cannot approve rejected candidate');
    }
    this._status = 'approved';
  }

  reject(): void {
    if (this._status === 'approved') {
      throw new Error('Cannot reject approved candidate');
    }
    this._status = 'rejected';
  }

  requestReview(): void {
    if (this._status !== 'proposed') {
      throw new Error('Can only request review for proposed candidates');
    }
    this._status = 'needs_review';
  }
}
