import { BaseEntity } from '../entities/index.js';

export type TaskStatus = 'pending' | 'in_progress' | 'done';

/**
 * TaskCard — a unit of work within a project.
 */
export class TaskCard extends BaseEntity<string> {
  private _status: TaskStatus;

  constructor(
    id: string,
    public readonly projectId: string,
    public readonly title: string,
    public readonly description: string | null = null,
    status: TaskStatus = 'pending',
    public readonly assignee: string | null = null,
    public readonly dueDate: Date | null = null,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._status = status;
  }

  get status(): TaskStatus {
    return this._status;
  }

  start(): void {
    if (this._status !== 'pending') {
      throw new Error(`Cannot start task in status ${this._status}`);
    }
    this._status = 'in_progress';
  }

  complete(): void {
    if (this._status !== 'in_progress') {
      throw new Error(`Cannot complete task in status ${this._status}`);
    }
    this._status = 'done';
  }
}
