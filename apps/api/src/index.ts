import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  AnalyzeMailThread,
  ApproveAction,
  IngestMailThread,
  PromoteProjectCandidate,
  RequestExternalActionApproval,
  ReviewProjectCandidate,
  SyncMailIntelligence,
  type ApprovalActor,
} from '@aios/application';
import {
  MailIntelligenceAdapter,
  PrismaApprovalRepository,
  PrismaMailThreadRepository,
  PrismaMailAutomationRepository,
  PrismaProjectCandidateRepository,
  PrismaProjectRepository,
} from '@aios/infrastructure';

export interface Phase6ApiDependencies {
  prisma?: PrismaClient;
  mailIntelligenceBaseUrl?: string;
}

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_review']),
  reason: z.string().trim().min(1).optional(),
});

const promotionSchema = z.object({
  projectName: z.string().trim().min(1),
  customerId: z.string().trim().min(1).optional(),
  owner: z.string().trim().min(1).optional(),
});

const approvalRequestSchema = z.object({
  actionType: z.enum(['email_send', 'document_share', 'api_call']),
  target: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()),
  description: z.string().trim().min(1),
});

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(1).optional(),
});

function actorFromRequest(req: Request): ApprovalActor {
  const id = req.header('x-actor-id')?.trim();
  const roles = req.header('x-actor-roles')
    ?.split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean) ?? [];
  if (!id) throw new Error('Authenticated actor header x-actor-id is required');
  return { id, roles };
}

function respondError(res: Response, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: error.issues });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = /not found/i.test(message) ? 404
    : /not authorized|authenticated actor/i.test(message) ? 403
      : /already|concurrently|cannot|requires|required/i.test(message) ? 409
        : 500;
  res.status(status).json({ error: message });
}

export function createPhase6Router(dependencies: Phase6ApiDependencies = {}): Router {
  const router = Router();
  const prisma = dependencies.prisma ?? new PrismaClient();
  const mailAdapter = new MailIntelligenceAdapter(
    dependencies.mailIntelligenceBaseUrl ?? process.env.MAIL_INTELLIGENCE_URL ?? ''
  );
  const threadRepo = new PrismaMailThreadRepository(prisma);
  const automationRepo = new PrismaMailAutomationRepository(prisma);
  const candidateRepo = new PrismaProjectCandidateRepository(prisma);
  const projectRepo = new PrismaProjectRepository(prisma);
  const approvalRepo = new PrismaApprovalRepository(prisma);

  router.get('/api/v2/mail/threads', async (req, res) => {
    try {
      const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
      if (Number.isNaN(since.getTime())) throw new Error('Invalid since date');
      res.json({ threads: await mailAdapter.listIngestibleThreads(since) });
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/mail/sync', async (req, res) => {
    try {
      const since = req.body?.since ? new Date(String(req.body.since)) : new Date(0);
      if (Number.isNaN(since.getTime())) throw new Error('Invalid since date');
      const useCase = new SyncMailIntelligence(
        mailAdapter,
        mailAdapter,
        threadRepo,
        automationRepo
      );
      res.json(await useCase.execute({ since }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/mail/threads/:threadKey/ingest', async (req, res) => {
    try {
      const useCase = new IngestMailThread(mailAdapter, threadRepo);
      res.status(201).json(await useCase.execute({
        sourceSystem: 'mail-intelligence',
        externalId: req.params.threadKey,
      }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/mail/threads/:threadId/analyze', async (req, res) => {
    try {
      const useCase = new AnalyzeMailThread(threadRepo, mailAdapter);
      res.json(await useCase.execute({ threadId: req.params.threadId }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/project-candidates/:candidateId/review', async (req, res) => {
    try {
      const input = reviewSchema.parse(req.body);
      res.json(await new ReviewProjectCandidate(candidateRepo).execute({
        candidateId: req.params.candidateId,
        ...input,
      }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/project-candidates/:candidateId/promote', async (req, res) => {
    try {
      const input = promotionSchema.parse(req.body);
      res.status(201).json(await new PromoteProjectCandidate(candidateRepo, projectRepo).execute({
        candidateId: req.params.candidateId,
        ...input,
      }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/projects/:projectId/approvals', async (req, res) => {
    try {
      const actor = actorFromRequest(req);
      const input = approvalRequestSchema.parse(req.body);
      res.status(201).json(await new RequestExternalActionApproval(approvalRepo).execute({
        projectId: req.params.projectId,
        requestedBy: actor.id,
        ...input,
      }));
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/api/v2/approvals/:approvalId/decide', async (req, res) => {
    try {
      const actor = actorFromRequest(req);
      const input = decisionSchema.parse(req.body);
      res.json(await new ApproveAction(approvalRepo).execute({
        approvalId: req.params.approvalId,
        actor,
        ...input,
      }));
    } catch (error) {
      respondError(res, error);
    }
  });

  return router;
}
