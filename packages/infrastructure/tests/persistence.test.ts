import { describe, it, expect, vi } from 'vitest';
import { PrismaApprovalRepository } from '../src/persistence/index.js';

describe('PrismaApprovalRepository', () => {
  it('should hydrate decision metadata when loading approvals', async () => {
    const decidedAt = new Date('2026-01-01T00:00:00.000Z');
    const prisma = {
      approvalRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'a1',
          projectId: 'p1',
          type: 'external_send',
          status: 'approved',
          requestedBy: 'user1',
          decidedBy: 'manager1',
          decidedAt,
          reason: 'Approved request',
          metadata: { actionType: 'email_send' },
        }),
      },
    } as any;
    const repo = new PrismaApprovalRepository(prisma);

    const request = await repo.findById('a1');

    expect(request?.decidedBy).toBe('manager1');
    expect(request?.decidedAt).toBe(decidedAt);
  });
});
