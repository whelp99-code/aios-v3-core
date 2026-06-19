import type { PrismaClient, Prisma } from '@prisma/client';
import type { MailThreadRepository } from '@aios/application';
import { MailThread, ExternalSourceId } from '@aios/domain';

/** Safely convert an unknown value to Prisma-compatible JSON */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * Prisma-backed MailThread repository.
 * Uses @@unique([sourceSystem, externalId]) for idempotency.
 */
export class PrismaMailThreadRepository implements MailThreadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(thread: MailThread): Promise<void> {
    const participants = toJson([...thread.participants]);
    const metadata = toJson(thread.metadata);

    await this.prisma.mailThread.upsert({
      where: {
        sourceSystem_externalId: {
          sourceSystem: thread.source.system,
          externalId: thread.source.id,
        },
      },
      create: {
        id: thread.id,
        sourceSystem: thread.source.system,
        externalId: thread.source.id,
        subject: thread.subject,
        participants,
        status: thread.status,
        metadata,
      },
      update: {
        subject: thread.subject,
        participants,
        status: thread.status,
        metadata,
      },
    });
  }

  async findById(id: string): Promise<MailThread | null> {
    const row = await this.prisma.mailThread.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByExternalId(system: string, externalId: string): Promise<MailThread | null> {
    const row = await this.prisma.mailThread.findUnique({
      where: {
        sourceSystem_externalId: { sourceSystem: system, externalId },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    sourceSystem: string;
    externalId: string;
    subject: string;
    participants: unknown;
    status: string;
    metadata: unknown;
  }): MailThread {
    const participants = Array.isArray(row.participants)
      ? (row.participants as string[])
      : [];
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};

    return new MailThread(
      row.id,
      new ExternalSourceId(row.sourceSystem, row.externalId),
      row.subject,
      participants,
      row.status as MailThread['status'],
      metadata
    );
  }
}
