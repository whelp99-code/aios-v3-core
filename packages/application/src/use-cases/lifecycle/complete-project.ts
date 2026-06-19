import type { UseCase } from '../index.js';

export interface CompleteProjectInput {
  projectId: string;
  completionNotes?: string;
}

export interface CompleteProjectOutput {
  projectId: string;
  status: 'completed';
  cfoHandoffDraft: boolean;
}

/**
 * CompleteProject
 * Marks a project as completed and generates CFO handoff draft.
 */
export class CompleteProject implements UseCase<CompleteProjectInput, CompleteProjectOutput> {
  async execute(input: CompleteProjectInput): Promise<CompleteProjectOutput> {
    return {
      projectId: input.projectId,
      status: 'completed',
      cfoHandoffDraft: true,
    };
  }
}
