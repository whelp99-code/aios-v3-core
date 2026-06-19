import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  AnalyzeMailThread,
  ApproveAction,
  CompleteProject,
  GenerateCustomerEmail,
  GenerateEstimate,
  GeneratePocPlan,
  GenerateProjectTasks,
  GenerateProposal,
  IngestMailThread,
  OpenMaintenanceCase,
  PrepareCfoHandoff,
  PromoteProjectCandidate,
  RequestExternalActionApproval,
  RegisterCustomerProduct,
  ReviewProjectCandidate,
  ProposeNewSolution,
  SyncMailIntelligence,
  type ApprovalActor,
} from '@aios/application';
import {
  MailIntelligenceAdapter,
  PrismaApprovalRepository,
  PrismaCustomerRepository,
  PrismaLifecycleRepository,
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

const taskSchema = z.object({ template: z.string().trim().min(1).optional() });
const lineItemSchema = z.object({
  description: z.string().trim().min(1), quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(), currency: z.string().trim().min(1),
  taxRate: z.number().min(0).max(100),
});
const estimateSchema = z.object({
  projectName: z.string().trim().min(1), customerName: z.string().trim().min(1),
  items: z.array(lineItemSchema).min(1), validDays: z.number().int().positive().optional(),
});
const proposalSchema = z.object({
  projectName: z.string().trim().min(1), customerName: z.string().trim().min(1),
  sections: z.array(z.object({ title: z.string().min(1), content: z.string().min(1) })).min(1),
});
const pocSchema = z.object({
  projectName: z.string().trim().min(1), objectives: z.array(z.string().min(1)).min(1),
  scope: z.string().min(1),
  timeline: z.array(z.object({ phase: z.string().min(1), duration: z.string().min(1) })),
  successCriteria: z.array(z.string().min(1)).min(1),
});
const emailDraftSchema = z.object({
  projectName: z.string().min(1), customerName: z.string().min(1),
  recipientEmail: z.string().email(), purpose: z.enum(['estimate', 'proposal', 'poc', 'follow_up']),
  customMessage: z.string().optional(),
});
const cfoSchema = z.object({
  projectName: z.string().min(1),
  items: z.array(z.object({
    category: z.string().min(1), description: z.string().min(1),
    amount: z.number().nonnegative(), currency: z.string().min(1),
  })).min(1),
});
const productSchema = z.object({
  projectId: z.string().min(1), projectName: z.string().min(1), productName: z.string().min(1),
  version: z.string().min(1), installationDate: z.coerce.date(),
});
const maintenanceSchema = z.object({
  customerId: z.string().min(1), productId: z.string().min(1), description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});
const solutionSchema = z.object({
  customerId: z.string().min(1), description: z.string().min(1),
  sourceEvidence: z.array(z.string().min(1)).min(1), estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
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
  const customerRepo = new PrismaCustomerRepository(prisma);
  const lifecycleRepo = new PrismaLifecycleRepository(prisma);

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

  router.post('/api/v2/projects/:projectId/tasks', async (req, res) => {
    try {
      const input = taskSchema.parse(req.body ?? {});
      res.status(201).json(await new GenerateProjectTasks(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/estimates', async (req, res) => {
    try {
      const input = estimateSchema.parse(req.body);
      res.status(201).json(await new GenerateEstimate(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/proposals', async (req, res) => {
    try {
      const input = proposalSchema.parse(req.body);
      res.status(201).json(await new GenerateProposal(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/poc-plans', async (req, res) => {
    try {
      const input = pocSchema.parse(req.body);
      res.status(201).json(await new GeneratePocPlan(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/email-drafts', async (req, res) => {
    try {
      const input = emailDraftSchema.parse(req.body);
      res.status(201).json(await new GenerateCustomerEmail(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/complete', async (req, res) => {
    try {
      res.json(await new CompleteProject(projectRepo).execute({
        projectId: req.params.projectId,
        completionNotes: typeof req.body?.completionNotes === 'string' ? req.body.completionNotes : undefined,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/projects/:projectId/cfo-handoffs', async (req, res) => {
    try {
      const input = cfoSchema.parse(req.body);
      res.status(201).json(await new PrepareCfoHandoff(projectRepo, lifecycleRepo).execute({
        projectId: req.params.projectId, ...input,
      }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/customers/:customerId/products', async (req, res) => {
    try {
      const input = productSchema.parse(req.body);
      res.status(201).json(await new RegisterCustomerProduct(
        customerRepo, projectRepo, lifecycleRepo
      ).execute({ customerId: req.params.customerId, ...input }));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/maintenance-cases', async (req, res) => {
    try {
      const input = maintenanceSchema.parse(req.body);
      res.status(201).json(await new OpenMaintenanceCase(customerRepo, lifecycleRepo).execute(input));
    } catch (error) { respondError(res, error); }
  });

  router.post('/api/v2/solution-proposals', async (req, res) => {
    try {
      const input = solutionSchema.parse(req.body);
      res.status(201).json(await new ProposeNewSolution(customerRepo, lifecycleRepo).execute(input));
    } catch (error) { respondError(res, error); }
  });

  return router;
}
