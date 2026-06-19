
import type { UseCase } from '../index.js';
import type { ProjectCandidateRepository, ProjectRepository } from '../../ports/index.js';
import { Project } from '@aios/domain';

export interface PromoteProjectCandidateInput {
  candidateId: string;
  projectName: string;
  customerId?: string;
  owner?: string;
}

export interface PromoteProjectCandidateOutput {
  projectId: string;
  candidateId: string;
}

/**
 * PromoteProjectCandidate
 * Promotes an approved candidate to a project.
 * Validates candidate exists and is in 'approved' status.
 * Idempotent: returns existing project reference if already promoted.
 */
export class PromoteProjectCandidate implements UseCase<PromoteProjectCandidateInput, PromoteProjectCandidateOutput> {
  constructor(
    private readonly candidateRepo: ProjectCandidateRepository,
    private readonly projectRepo: ProjectRepository
  ) {}

  async execute(input: PromoteProjectCandidateInput): Promise<PromoteProjectCandidateOutput> {
    const candidate = await this.candidateRepo.findById(input.candidateId);
    if (!candidate) {
      throw new Error(`Project candidate ${input.candidateId} not found`);
    }

    if (candidate.status !== 'approved') {
      throw new Error(
        `Cannot promote candidate in status ${candidate.status}; must be 'approved'`
      );
    }

    const existing = await this.projectRepo.findByCandidateId(candidate.id);
    if (existing) {
      return { projectId: existing.id, candidateId: candidate.id };
    }

    const project = new Project(
      globalThis.crypto.randomUUID(),
      input.projectName,
      input.customerId ?? candidate.customerId,
      candidate.id,
      'candidate',
      input.owner ?? null
    );
    const persisted = await this.projectRepo.promoteCandidate(project);

    return {
      projectId: persisted.id,
      candidateId: input.candidateId,
    };
  }
}
