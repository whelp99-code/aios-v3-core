import type { PrismaClient, Prisma } from '@prisma/client';
import type { ApprovalRepository } from '@aios/application';
import { ApprovalRequest, type ApprovalType, type ApprovalStatus } from '@aios/domain';

/** Safely convert an unknown value to Prisma-compatible JSON */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * Prisma-backed ApprovalRequest repository.
 */
export class PrismaApprovalRepository implements ApprovalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(request: ApprovalRequest): Promise<void> {
    const metadata = toJson(request.metadata);

    await this.prisma.approvalRequest.upsert({
      where: { id: request.id },
      create: {
        id: request.id,
        projectId: request.projectId,
        type: request.type,
        status: request.status,
        requestedBy: request.requestedBy,
        decidedBy: request.decidedBy,
        decidedAt: request.decidedAt,
        reason: request.reason,
        metadata,
      },
      update: {
        status: request.status,
        decidedBy: request.decidedBy,
        decidedAt: request.decidedAt,
        reason: request.reason,
        metadata,
      },
    });
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    const row = await this.prisma.approvalRequest.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findPendingByProject(projectId: string): Promise<ApprovalRequest[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { projectId, status: 'pending' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    projectId: string;
    type: string;
    status: string;
    requestedBy: string;
    decidedBy: string | null;
    decidedAt: Date | null;
    reason: string | null;
    metadata: unknown;
  }): ApprovalRequest {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    return new ApprovalRequest(
      row.id,
      row.projectId,
      row.type as ApprovalType,
      row.requestedBy,
      row.status as ApprovalStatus,
      row.reason,
      metadata
    );
  }
}
