import type { PrismaClient, Prisma } from '@prisma/client';
import type { ProjectCandidateRepository } from '@aios/application';
import { ProjectCandidate, ConfidenceScore, type CandidateStatus } from '@aios/domain';

/** Safely convert an unknown value to Prisma-compatible JSON */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * Prisma-backed ProjectCandidate repository.
 * Uses threadId for duplicate promotion prevention.
 */
export class PrismaProjectCandidateRepository implements ProjectCandidateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(candidate: ProjectCandidate): Promise<void> {
    const metadata = toJson(candidate.metadata);

    await this.prisma.projectCandidate.upsert({
      where: { id: candidate.id },
      create: {
        id: candidate.id,
        threadId: candidate.threadId,
        customerId: candidate.customerId,
        confidence: candidate.confidence.value,
        status: candidate.status,
        metadata,
      },
      update: {
        customerId: candidate.customerId,
        confidence: candidate.confidence.value,
        status: candidate.status,
        metadata,
      },
    });
  }

  async findById(id: string): Promise<ProjectCandidate | null> {
    const row = await this.prisma.projectCandidate.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByThreadId(threadId: string): Promise<ProjectCandidate | null> {
    const row = await this.prisma.projectCandidate.findFirst({ where: { threadId } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    threadId: string;
    customerId: string | null;
    confidence: number;
    status: string;
    metadata: unknown;
  }): ProjectCandidate {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    return new ProjectCandidate(
      row.id,
      row.threadId,
      row.customerId,
      new ConfidenceScore(row.confidence),
      row.status as CandidateStatus,
      metadata
    );
  }
}
