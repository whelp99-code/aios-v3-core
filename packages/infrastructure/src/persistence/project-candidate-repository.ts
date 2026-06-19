import type { ProjectCandidateRepository } from '@aios/application';

export class ProjectCandidateRepositoryImpl implements ProjectCandidateRepository {
  constructor(private prisma: { projectCandidate: unknown }) {}

  async save(_candidate: unknown): Promise<void> {
    throw new Error('Not implemented — run db:generate first');
  }

  async findById(_id: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }

  async findByThreadId(_threadId: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }
}
