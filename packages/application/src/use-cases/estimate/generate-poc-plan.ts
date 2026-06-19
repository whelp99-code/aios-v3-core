
import type { UseCase } from '../index.js';
import { PocPlanDraft } from '@aios/domain';
import type { LifecycleRepository, ProjectRepository } from '../../ports/index.js';
import { requireProjectInStatus } from '../../validation/lifecycle-state.js';

export interface GeneratePocPlanInput {
  projectId: string;
  projectName: string;
  objectives: string[];
  scope: string;
  timeline: Array<{ phase: string; duration: string }>;
  successCriteria: string[];
}

export interface GeneratePocPlanOutput {
  pocPlanId: string;
  status: 'draft';
}

/**
 * GeneratePocPlan
 * Creates a POC plan draft.
 */
export class GeneratePocPlan implements UseCase<GeneratePocPlanInput, GeneratePocPlanOutput> {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly lifecycleRepo: LifecycleRepository
  ) {}

  async execute(input: GeneratePocPlanInput): Promise<GeneratePocPlanOutput> {
    await requireProjectInStatus(this.projectRepo, input.projectId, ['candidate', 'active']);
    if (input.objectives.length === 0 || input.successCriteria.length === 0) {
      throw new Error('POC plan requires objectives and success criteria');
    }
    const plan = new PocPlanDraft(
      globalThis.crypto.randomUUID(), input.projectId, input.objectives,
      input.scope, input.timeline, input.successCriteria
    );
    await this.lifecycleRepo.savePocPlan(plan);
    return {
      pocPlanId: plan.id,
      status: 'draft',
    };
  }
}
