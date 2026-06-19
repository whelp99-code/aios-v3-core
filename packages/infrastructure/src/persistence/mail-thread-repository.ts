import type { MailThreadRepository } from '@aios/application';

/**
 * MailThreadRepository — Prisma-backed implementation.
 * Implements idempotency via (sourceSystem, externalId) unique constraint.
 */
export class MailThreadRepositoryImpl implements MailThreadRepository {
  constructor(private prisma: { mailThread: unknown }) {}

  async save(_thread: unknown): Promise<void> {
    // Will be implemented with Prisma after db:generate
    throw new Error('Not implemented — run db:generate first');
  }

  async findById(_id: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }

  async findByExternalId(_system: string, _externalId: string): Promise<unknown | null> {
    throw new Error('Not implemented — run db:generate first');
  }
}
