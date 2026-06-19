/**
 * Domain Events
 * Events that occur within the domain.
 */

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

/** Base class for domain events */
export abstract class BaseDomainEvent implements DomainEvent {
  abstract readonly eventType: string;
  readonly occurredAt: Date;

  constructor(public readonly aggregateId: string) {
    this.occurredAt = new Date();
  }
}

/** Mail thread ingested event */
export class MailThreadIngested extends BaseDomainEvent {
  readonly eventType = 'MailThreadIngested';
}

/** Mail thread analyzed event */
export class MailThreadAnalyzed extends BaseDomainEvent {
  readonly eventType = 'MailThreadAnalyzed';
}

/** Project candidate proposed event */
export class ProjectCandidateProposed extends BaseDomainEvent {
  readonly eventType = 'ProjectCandidateProposed';
}

/** Approval requested event */
export class ApprovalRequested extends BaseDomainEvent {
  readonly eventType = 'ApprovalRequested';
}
