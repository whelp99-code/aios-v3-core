/**
 * F-aios-v3 API Contract Schemas (Zod)
 *
 * Phase 0: Baseline and contract fixing
 * - Define F server <-> AIOS v2 proxy contracts via Zod schemas
 * - Fix existing response fields as compatibility contract
 * - New fields are additive only
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Common types
// ──────────────────────────────────────────────

/** Common execution status */
export const ExecutionStatusSchema = z.enum([
  'queued',
  'pending_approval',
  'running',
  'completed',
  'failed',
  'cancelled',
  'degraded',
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

/** Execution mode */
export const ExecutionModeSchema = z.enum(['live', 'simulated', 'degraded']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const EngineModeSchema = z.enum(['auto', 'local', 'cloud']);
export type EngineMode = z.infer<typeof EngineModeSchema>;

/** Common execution response fields */
export const ExecutionResponseSchema = z.object({
  executionId: z.string(),
  status: ExecutionStatusSchema,
  mode: ExecutionModeSchema,
  approvalId: z.string().optional(),
  traceId: z.string().optional(),
  createdAt: z.string(),
});
export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

/** Common error response */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  status: z.enum(['degraded', 'failed']).optional(),
  mode: ExecutionModeSchema.optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ──────────────────────────────────────────────
// Health API
// ──────────────────────────────────────────────

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ──────────────────────────────────────────────
// Workflow API
// ──────────────────────────────────────────────

/** Workflow step */
export const WorkflowStepSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/** Workflow object */
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  favorite: z.boolean(),
  steps: z.array(WorkflowStepSchema),
  lastRun: z.number().nullable(),
  runCount: z.number(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

/** POST /api/workflows request */
export const WorkflowCreateRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default(''),
  category: z.string().optional().default('etc'),
  steps: z.array(WorkflowStepSchema).min(1, 'at least one step required'),
});
export type WorkflowCreateRequest = z.infer<typeof WorkflowCreateRequestSchema>;

/** POST /api/workflows/:id/execute request */
export const WorkflowExecuteRequestSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowExecuteRequest = z.infer<typeof WorkflowExecuteRequestSchema>;

/** POST /api/workflows/:id/execute response */
export const WorkflowExecuteResponseSchema = ExecutionResponseSchema.extend({
  workflowId: z.string(),
  workflow: z.string(),
  result: z.unknown().optional(),
});
export type WorkflowExecuteResponse = z.infer<typeof WorkflowExecuteResponseSchema>;

/** POST /api/workflow/execute (legacy) request */
export const WorkflowLegacyExecuteRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  steps: z.array(WorkflowStepSchema).min(1, 'at least one step required'),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowLegacyExecuteRequest = z.infer<typeof WorkflowLegacyExecuteRequestSchema>;

/** POST /api/workflow/execute (legacy) response */
export const WorkflowLegacyExecuteResponseSchema = z.object({
  workflow: z.string(),
  result: z.unknown(),
});
export type WorkflowLegacyExecuteResponse = z.infer<typeof WorkflowLegacyExecuteResponseSchema>;

// ──────────────────────────────────────────────
// Orchestrator API
// ──────────────────────────────────────────────

/** GET /api/orchestrator response */
export const OrchestratorStatusSchema = z.object({
  status: z.literal('ok'),
  engineMode: z.string(),
  activeRuns: z.number(),
  lastRun: z.unknown().nullable(),
});
export type OrchestratorStatus = z.infer<typeof OrchestratorStatusSchema>;

/** POST /api/orchestrator/run request */
export const OrchestratorRunRequestSchema = z.object({
  task: z.string().min(1, 'task is required'),
  input: z.record(z.string(), z.unknown()).optional(),
  mode: EngineModeSchema.optional().default('local'),
});
export type OrchestratorRunRequest = z.infer<typeof OrchestratorRunRequestSchema>;

/** POST /api/orchestrator/run response */
export const OrchestratorRunResponseSchema = ExecutionResponseSchema.extend({
  task: z.string(),
  engineMode: EngineModeSchema,
});
export type OrchestratorRunResponse = z.infer<typeof OrchestratorRunResponseSchema>;

// ──────────────────────────────────────────────
// Knowledge API
// ──────────────────────────────────────────────

/** Knowledge document object */
export const KnowledgeDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  createdAt: z.string(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

/** POST /api/knowledge request */
export const KnowledgeCreateRequestSchema = z.object({
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  category: z.string().optional().default('general'),
});
export type KnowledgeCreateRequest = z.infer<typeof KnowledgeCreateRequestSchema>;

// ──────────────────────────────────────────────
// LightRAG API
// ──────────────────────────────────────────────

/** GET /api/lightrag response */
export const LightRAGStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('lightrag'),
  upstream: z.unknown().nullable(),
  mode: ExecutionModeSchema.optional(),
  error: z.string().optional(),
});
export type LightRAGStatus = z.infer<typeof LightRAGStatusSchema>;

/** GET /api/lightrag/search response */
export const LightRAGSearchResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  mode: ExecutionModeSchema,
  results: z.array(z.unknown()),
  message: z.string().optional(),
});
export type LightRAGSearchResponse = z.infer<typeof LightRAGSearchResponseSchema>;

/** POST /api/lightrag/ingest request */
export const LightRAGIngestRequestSchema = z.object({
  content: z.string().min(1, 'content is required'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type LightRAGIngestRequest = z.infer<typeof LightRAGIngestRequestSchema>;

/** POST /api/lightrag/ingest response */
export const LightRAGIngestResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  documentId: z.string(),
  result: z.unknown().optional(),
  mode: ExecutionModeSchema,
  message: z.string().optional(),
});
export type LightRAGIngestResponse = z.infer<typeof LightRAGIngestResponseSchema>;

// ──────────────────────────────────────────────
// Monitoring API
// ──────────────────────────────────────────────

/** Service status */
export const ServiceStatusSchema = z.object({
  status: z.string(),
  mode: ExecutionModeSchema.optional(),
  uptime: z.number().optional(),
});
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

/** GET /api/monitoring response */
export const MonitoringResponseSchema = z.object({
  status: z.literal('ok'),
  services: z.record(z.string(), ServiceStatusSchema),
  metrics: z.object({
    totalWorkflows: z.number(),
    totalExecutions: z.number(),
    activeRuns: z.number(),
    failedRuns: z.number(),
  }),
  timestamp: z.string(),
});
export type MonitoringResponse = z.infer<typeof MonitoringResponseSchema>;

/** GET /api/monitoring/:service response */
export const MonitoringServiceDetailSchema = z.object({
  name: z.string(),
  status: z.string(),
  mode: ExecutionModeSchema.optional(),
  port: z.number().optional(),
  uptime: z.number().optional(),
  memoryUsage: z.unknown().optional(),
  serverUrl: z.string().optional(),
});
export type MonitoringServiceDetail = z.infer<typeof MonitoringServiceDetailSchema>;

// ──────────────────────────────────────────────
// API Contract Map (for v2 proxy validation)
// ──────────────────────────────────────────────

/**
 * F API endpoints that AIOS v2 proxy expects.
 * Contract tests iterate this map to verify consistency.
 */
export const F_API_CONTRACT = {
  health: {
    'GET /api/health': { response: HealthResponseSchema },
  },
  workflows: {
    'GET /api/workflows': { response: z.array(WorkflowSchema) },
    'GET /api/workflows/:id': { response: WorkflowSchema },
    'POST /api/workflows': {
      request: WorkflowCreateRequestSchema,
      response: WorkflowSchema,
    },
    'DELETE /api/workflows/:id': {
      response: z.object({ success: z.boolean() }),
    },
    'POST /api/workflows/:id/execute': {
      request: WorkflowExecuteRequestSchema,
      response: WorkflowExecuteResponseSchema,
    },
    'POST /api/workflow/execute': {
      request: WorkflowLegacyExecuteRequestSchema,
      response: WorkflowLegacyExecuteResponseSchema,
    },
  },
  orchestrator: {
    'GET /api/orchestrator': { response: OrchestratorStatusSchema },
    'POST /api/orchestrator/run': {
      request: OrchestratorRunRequestSchema,
      response: OrchestratorRunResponseSchema,
    },
  },
  knowledge: {
    'GET /api/knowledge': { response: z.array(KnowledgeDocumentSchema) },
    'GET /api/knowledge/search': { response: z.array(KnowledgeDocumentSchema) },
    'POST /api/knowledge': {
      request: KnowledgeCreateRequestSchema,
      response: KnowledgeDocumentSchema,
    },
  },
  lightrag: {
    'GET /api/lightrag': { response: LightRAGStatusSchema },
    'GET /api/lightrag/search': { response: LightRAGSearchResponseSchema },
    'POST /api/lightrag/ingest': {
      request: LightRAGIngestRequestSchema,
      response: LightRAGIngestResponseSchema,
    },
  },
  monitoring: {
    'GET /api/monitoring': { response: MonitoringResponseSchema },
    'GET /api/monitoring/service': { response: MonitoringServiceDetailSchema },
  },
} as const;

/** Total F API endpoint count */
export const F_API_ENDPOINT_COUNT = Object.values(F_API_CONTRACT)
  .flatMap(group => Object.keys(group))
  .length;
