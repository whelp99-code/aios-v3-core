import { BaseEntity } from '../entities/index.js';
import { ExternalSourceId } from '../value-objects/index.js';

export type MailThreadStatus = 'ingested' | 'analyzed' | 'promoted' | 'archived';

/**
 * MailThread — a conversation thread with participants.
 * Invariant: sourceSystem + externalId must be unique (idempotency).
 */
export class MailThread extends BaseEntity<string> {
  private _status: MailThreadStatus;
  private _participants: string[];
  private _metadata: Record<string, unknown>;

  constructor(
    id: string,
    public readonly source: ExternalSourceId,
    public readonly subject: string,
    participants: string[],
    status: MailThreadStatus = 'ingested',
    metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._status = status;
    this._participants = [...participants];
    this._metadata = { ...metadata };
  }

  get status(): MailThreadStatus {
    return this._status;
  }

  get participants(): readonly string[] {
    return this._participants;
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this._metadata;
  }

  analyze(): void {
    if (this._status !== 'ingested') {
      throw new Error(`Cannot analyze thread in status ${this._status}`);
    }
    this._status = 'analyzed';
  }

  promote(): void {
    if (this._status !== 'analyzed') {
      throw new Error(`Cannot promote thread in status ${this._status}`);
    }
    this._status = 'promoted';
  }
}
