import type { Project, ProjectStatus } from '@aios/domain';
import type { CustomerRepository, ProjectRepository } from '../ports/index.js';

export async function requireProjectInStatus(
  repository: ProjectRepository,
  projectId: string,
  allowedStatuses: ProjectStatus[]
): Promise<Project> {
  const project = await repository.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!allowedStatuses.includes(project.status)) {
    throw new Error(`Project ${projectId} in status ${project.status} cannot perform this action`);
  }
  return project;
}

export async function requireProjectCustomer(
  project: Project,
  repository: CustomerRepository
): Promise<void> {
  if (!project.customerId || !await repository.findById(project.customerId)) {
    throw new Error(`Customer for project ${project.id} not found`);
  }
}
