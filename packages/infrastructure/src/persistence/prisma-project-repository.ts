import type { PrismaClient, Prisma } from '@prisma/client';
import type { ProjectRepository } from '@aios/application';
import { Project, type ProjectStatus } from '@aios/domain';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(project: Project): Promise<Project> {
    if (project.candidateId) {
      const row = await this.prisma.project.upsert({
        where: { candidateId: project.candidateId },
        create: this.toCreateData(project),
        update: {
          status: project.status,
          owner: project.owner,
          dueDate: project.dueDate,
          metadata: toJson(project.metadata),
        },
      });
      return this.toDomain(row);
    }

    const row = await this.prisma.project.upsert({
      where: { id: project.id },
      create: this.toCreateData(project),
      update: {
        name: project.name,
        customerId: project.customerId,
        status: project.status,
        owner: project.owner,
        dueDate: project.dueDate,
        metadata: toJson(project.metadata),
      },
    });
    return this.toDomain(row);
  }

  async promoteCandidate(project: Project): Promise<Project> {
    if (!project.candidateId) throw new Error('Project promotion requires a candidateId');
    const candidateId = project.candidateId;
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.projectCandidate.findUnique({
        where: { id: candidateId },
      });
      if (!candidate) throw new Error(`Project candidate ${candidateId} not found`);
      if (candidate.status !== 'approved') {
        throw new Error(`Cannot promote candidate in status ${candidate.status}`);
      }

      const row = await tx.project.upsert({
        where: { candidateId },
        create: this.toCreateData(project),
        update: {
          status: project.status,
          owner: project.owner,
          dueDate: project.dueDate,
          metadata: toJson(project.metadata),
        },
      });
      await tx.mailThread.update({
        where: { id: candidate.threadId },
        data: { status: 'promoted' },
      });
      return this.toDomain(row);
    });
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCandidateId(candidateId: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { candidateId } });
    return row ? this.toDomain(row) : null;
  }

  private toCreateData(project: Project) {
    return {
      id: project.id,
      name: project.name,
      customerId: project.customerId,
      candidateId: project.candidateId,
      status: project.status,
      owner: project.owner,
      dueDate: project.dueDate,
      metadata: toJson(project.metadata),
    };
  }

  private toDomain(row: {
    id: string;
    name: string;
    customerId: string | null;
    candidateId: string | null;
    status: string;
    owner: string | null;
    dueDate: Date | null;
    metadata: unknown;
  }): Project {
    return new Project(
      row.id,
      row.name,
      row.customerId,
      row.candidateId,
      row.status as ProjectStatus,
      row.owner,
      row.dueDate,
      row.metadata && typeof row.metadata === 'object'
        ? row.metadata as Record<string, unknown>
        : {}
    );
  }
}
