import type { PrismaClient, Prisma } from '@prisma/client';
import type { ApprovalDecisionCommand, ApprovalRepository } from '@aios/application';
import {
  ApprovalRequest,
  type ApprovalAction,
  type ApprovalStatus,
  type ApprovalType,
} from '@aios/domain';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export class PrismaApprovalRepository implements ApprovalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(request: ApprovalRequest): Promise<void> {
    await this.prisma.approvalRequest.create({
      data: {
        id: request.id,
        projectId: request.projectId,
        type: request.type,
        status: request.status,
        requestedBy: request.requestedBy,
        decidedBy: request.decidedBy,
        decidedAt: request.decidedAt,
        reason: request.reason,
        metadata: toJson(request.metadata),
        actionType: request.action?.type,
        actionTarget: request.action?.target,
        actionPayload: request.action ? toJson(request.action.payload) : undefined,
        payloadHash: request.action?.payloadHash,
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

  async decidePending(input: ApprovalDecisionCommand): Promise<ApprovalRequest | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.approvalRequest.updateMany({
        where: { id: input.approvalId, status: 'pending' },
        data: {
          status: input.decision,
          decidedBy: input.actorId,
          decidedAt: input.decidedAt,
          reason: input.reason,
        },
      });

      if (updated.count !== 1) return null;

      const request = await tx.approvalRequest.findUniqueOrThrow({
        where: { id: input.approvalId },
      });

      await tx.approvalDecision.create({
        data: {
          approvalId: request.id,
          decision: input.decision,
          actorId: input.actorId,
          reason: input.reason,
          decidedAt: input.decidedAt,
        },
      });

      await tx.auditEvent.create({
        data: {
          aggregateType: 'ApprovalRequest',
          aggregateId: request.id,
          eventType: input.decision === 'approved' ? 'ApprovalApproved' : 'ApprovalRejected',
          actorId: input.actorId,
          data: toJson({ reason: input.reason, payloadHash: request.payloadHash }),
        },
      });

      if (
        input.decision === 'approved' &&
        request.actionType &&
        request.actionTarget &&
        request.actionPayload &&
        request.payloadHash
      ) {
        await tx.externalActionOutbox.create({
          data: {
            approvalId: request.id,
            projectId: request.projectId,
            actionType: request.actionType,
            target: request.actionTarget,
            payload: request.actionPayload,
            payloadHash: request.payloadHash,
          },
        });
      }

      return this.toDomain(request);
    });
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
    actionType: string | null;
    actionTarget: string | null;
    actionPayload: unknown;
    payloadHash: string | null;
  }): ApprovalRequest {
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {};
    const action = this.toAction(row);

    return new ApprovalRequest(
      row.id,
      row.projectId,
      row.type as ApprovalType,
      row.requestedBy,
      row.status as ApprovalStatus,
      row.reason,
      metadata,
      row.decidedBy,
      row.decidedAt,
      action
    );
  }

  private toAction(row: {
    actionType: string | null;
    actionTarget: string | null;
    actionPayload: unknown;
    payloadHash: string | null;
  }): ApprovalAction | null {
    if (!row.actionType || !row.actionTarget || !row.payloadHash) return null;
    return {
      type: row.actionType as ApprovalAction['type'],
      target: row.actionTarget,
      payload: row.actionPayload && typeof row.actionPayload === 'object'
        ? row.actionPayload as Record<string, unknown>
        : {},
      payloadHash: row.payloadHash,
    };
  }
}
