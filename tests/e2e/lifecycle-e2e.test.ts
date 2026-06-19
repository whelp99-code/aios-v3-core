import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPhase6Router } from '../../apps/api/src/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function close(server: Server | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function request<T>(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const body = await response.json() as T;
  return { status: response.status, body };
}

describeDatabase('Portal Bridge → API → PostgreSQL lifecycle E2E', () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  let portalServer: Server | undefined;
  let apiServer: Server | undefined;
  let apiBaseUrl = '';

  beforeAll(async () => {
    await prisma.maintenanceCase.deleteMany();
    await prisma.solutionProposal.deleteMany();
    await prisma.customerProduct.deleteMany();
    await prisma.cfoHandoff.deleteMany();
    await prisma.emailDraft.deleteMany();
    await prisma.pocPlan.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.estimate.deleteMany();
    await prisma.externalActionOutbox.deleteMany();
    await prisma.approvalDecision.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.taskCard.deleteMany();
    await prisma.project.deleteMany();
    await prisma.projectCandidate.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.mailMessage.deleteMany();
    await prisma.mailThread.deleteMany();

    const portal = express();
    portal.get('/api/portal/thread-insights', (_req, res) => res.json({
      threads: [{
        threadKey: 'portal-thread-1',
        threadTitle: 'AIOS rollout request',
        sourceProvider: 'mail-intelligence',
        messageCount: 1,
        messageIds: ['portal-message-1'],
        latestReceivedAt: '2026-06-19T00:00:00.000Z',
        status: 'active',
        aiEnhanced: true,
        summary: 'Please prepare a rollout proposal.',
        nextActions: [{ recommendedAction: 'Prepare rollout proposal', owner: 'delivery' }],
        evidenceItems: ['Customer requested a rollout proposal'],
        participantDomains: ['customer.example'],
        metadata: {},
      }],
      count: 1,
    }));
    portal.get('/api/portal/thread/:threadKey', (req, res) => res.json({
      thread: {
        key: req.params.threadKey,
        label: 'AIOS rollout request',
        count: 1,
        messageIds: ['portal-message-1'],
        participants: ['buyer@customer.example'],
      },
      messages: [{
        id: 'portal-message-1',
        subject: 'AIOS rollout request',
        from: 'buyer@customer.example',
        to: ['delivery@aios.local'],
        cc: [],
        receivedAt: '2026-06-19T00:00:00.000Z',
        bodyPreview: 'Please prepare a rollout proposal.',
        attachmentNames: ['requirements.xlsx'],
      }],
    }));
    portal.get('/api/portal/entity-candidates', (_req, res) => res.json({
      candidates: [{
        email: 'buyer@customer.example',
        domain: 'customer.example',
        candidateName: 'Customer Example',
        entityRole: 'customer',
        confidence: 0.95,
      }],
      count: 1,
    }));
    portal.get('/api/portal/calendar-hints', (_req, res) => res.json({
      calendar: [{
        title: 'Proposal deadline',
        when: '2026-06-30T00:00:00.000Z',
        messageId: 'portal-message-1',
      }],
      count: 1,
    }));
    portal.get('/api/outlook/health', (_req, res) => res.json({ status: 'ok' }));
    const portalListener = await listen(portal);
    portalServer = portalListener.server;

    const api = express();
    api.use(express.json());
    api.use(createPhase6Router({
      prisma,
      mailIntelligenceBaseUrl: portalListener.baseUrl,
      resolveApprovalActor: (req) => {
        const id = req.header('x-test-principal-id')?.trim();
        if (!id) return null;
        const roles = req.header('x-test-principal-roles')
          ?.split(',')
          .map((role) => role.trim())
          .filter(Boolean) ?? [];
        return { id, roles };
      },
    }));
    const apiListener = await listen(api);
    apiServer = apiListener.server;
    apiBaseUrl = apiListener.baseUrl;
  });

  afterAll(async () => {
    await close(apiServer);
    await close(portalServer);
    await prisma.$disconnect();
  });

  it('persists mail data, promotes a project, and emits exactly one approved outbox action', async () => {
    const sync = await request<{
      ingested: number;
      results: Array<{ threadId: string; customerId: string; candidateId: string }>;
    }>(apiBaseUrl, '/api/v2/mail/sync', {
      method: 'POST',
      body: JSON.stringify({ since: '2026-01-01T00:00:00.000Z' }),
    });
    expect(sync.status).toBe(200);
    expect(sync.body.ingested).toBe(1);
    expect(await prisma.mailThread.count()).toBe(1);
    expect(await prisma.mailMessage.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.contact.count()).toBe(1);

    const candidateId = sync.body.results[0]?.candidateId;
    const customerId = sync.body.results[0]?.customerId;
    expect(candidateId).toBeTruthy();
    expect(customerId).toBeTruthy();

    const review = await request<{ status: string }>(
      apiBaseUrl,
      `/api/v2/project-candidates/${candidateId}/review`,
      { method: 'POST', body: JSON.stringify({ action: 'approve' }) },
    );
    expect(review).toMatchObject({ status: 200, body: { status: 'approved' } });

    const promotion = await request<{ projectId: string }>(
      apiBaseUrl,
      `/api/v2/project-candidates/${candidateId}/promote`,
      { method: 'POST', body: JSON.stringify({ projectName: 'Customer AIOS rollout' }) },
    );
    expect(promotion.status).toBe(201);
    expect(await prisma.project.count({ where: { candidateId } })).toBe(1);

    const draft = await request<{ draftId: string; status: string; approvalRequired: boolean }>(
      apiBaseUrl,
      `/api/v2/projects/${promotion.body.projectId}/email-drafts`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectName: 'Customer AIOS rollout',
          customerName: 'Customer Example',
          recipientEmail: 'buyer@customer.example',
          purpose: 'proposal',
        }),
      },
    );
    expect(draft).toMatchObject({
      status: 201,
      body: { status: 'draft', approvalRequired: true },
    });

    const unauthenticatedRequest = await request<{ error: string }>(
      apiBaseUrl,
      `/api/v2/projects/${promotion.body.projectId}/approvals`,
      {
        method: 'POST',
        body: JSON.stringify({
          actionType: 'email_send',
          target: 'buyer@customer.example',
          payload: { draftId: draft.body.draftId },
          description: 'Unauthenticated request must fail closed',
        }),
      },
    );
    expect(unauthenticatedRequest.status).toBe(403);

    const approval = await request<{ approvalId: string; status: string }>(
      apiBaseUrl,
      `/api/v2/projects/${promotion.body.projectId}/approvals`,
      {
        method: 'POST',
        headers: { 'x-test-principal-id': 'requester-1', 'x-test-principal-roles': 'operator' },
        body: JSON.stringify({
          actionType: 'email_send',
          target: 'buyer@customer.example',
          payload: { draftId: draft.body.draftId },
          description: 'Send the approved proposal email',
        }),
      },
    );
    expect(approval).toMatchObject({ status: 201, body: { status: 'pending' } });
    expect(await prisma.externalActionOutbox.count()).toBe(0);

    const unauthorized = await request<{ error: string }>(
      apiBaseUrl,
      `/api/v2/approvals/${approval.body.approvalId}/decide`,
      {
        method: 'POST',
        headers: { 'x-test-principal-id': 'viewer-1', 'x-test-principal-roles': 'viewer' },
        body: JSON.stringify({ decision: 'approve' }),
      },
    );
    expect(unauthorized.status).toBe(403);
    expect(await prisma.externalActionOutbox.count()).toBe(0);

    const selfApproval = await request<{ error: string }>(
      apiBaseUrl,
      `/api/v2/approvals/${approval.body.approvalId}/decide`,
      {
        method: 'POST',
        headers: { 'x-test-principal-id': 'requester-1', 'x-test-principal-roles': 'approver' },
        body: JSON.stringify({ decision: 'approve' }),
      },
    );
    expect(selfApproval.status).toBe(409);

    const race = await Promise.all([
      request<{ decision?: string; error?: string }>(
        apiBaseUrl,
        `/api/v2/approvals/${approval.body.approvalId}/decide`,
        {
          method: 'POST',
          headers: { 'x-test-principal-id': 'approver-1', 'x-test-principal-roles': 'approver' },
          body: JSON.stringify({ decision: 'approve' }),
        },
      ),
      request<{ decision?: string; error?: string }>(
        apiBaseUrl,
        `/api/v2/approvals/${approval.body.approvalId}/decide`,
        {
          method: 'POST',
          headers: { 'x-test-principal-id': 'admin-1', 'x-test-principal-roles': 'admin' },
          body: JSON.stringify({ decision: 'approve' }),
        },
      ),
    ]);
    expect(race.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await prisma.approvalDecision.count({ where: { approvalId: approval.body.approvalId } })).toBe(1);
    expect(await prisma.externalActionOutbox.count({ where: { approvalId: approval.body.approvalId } })).toBe(1);
    expect(await prisma.auditEvent.count({
      where: { aggregateType: 'ApprovalRequest', aggregateId: approval.body.approvalId },
    })).toBe(1);
  });
});
