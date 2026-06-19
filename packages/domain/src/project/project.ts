import { BaseEntity } from '../entities/index.js';

export type ProjectStatus = 'candidate' | 'active' | 'completed' | 'rejected';

/**
 * Project — a business project.
 */
export class Project extends BaseEntity<string> {
  private _status: ProjectStatus;

  constructor(
    id: string,
    public readonly name: string,
    public readonly customerId: string | null,
    public readonly candidateId: string | null,
    status: ProjectStatus = 'candidate',
    public readonly owner: string | null = null,
    public readonly dueDate: Date | null = null,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
    this._status = status;
  }

  get status(): ProjectStatus {
    return this._status;
  }

  activate(): void {
    if (this._status !== 'candidate') {
      throw new Error(`Cannot activate project in status ${this._status}`);
    }
    this._status = 'active';
  }

  complete(): void {
    if (this._status !== 'active') {
      throw new Error(`Cannot complete project in status ${this._status}`);
    }
    this._status = 'completed';
  }

  reject(): void {
    if (this._status === 'completed') {
      throw new Error('Cannot reject completed project');
    }
    this._status = 'rejected';
  }
}
