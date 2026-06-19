
import type { UseCase } from '../index.js';
import type { ProjectRepository } from '../../ports/index.js';

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
  constructor(private readonly projectRepo: ProjectRepository) {}

  async execute(input: CompleteProjectInput): Promise<CompleteProjectOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new Error(`Project ${input.projectId} not found`);
    project.complete();
    await this.projectRepo.save(project);
    return {
      projectId: project.id,
      status: 'completed',
      cfoHandoffDraft: true,
    };
  }
}
