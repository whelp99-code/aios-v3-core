/**
 * F-aios-v3 API Contract
 *
 * 이 파일은 F 서버와 AIOS v2 프록시 간의 공개 API 계약을 정의합니다.
 * 모든 응답은 이 스키마를 따라야 합니다.
 */

// ─── 공통 응답 타입 ───────────────────────────────────────────────

export type ExecutionStatus =
  | 'queued'
  | 'pending_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'degraded';

export type ExecutionMode = 'live' | 'simulated' | 'degraded';

export interface ExecutionResponse {
  executionId: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  approvalId?: string;
  traceId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

// ─── Health ───────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  uptime: number;
  version?: string;
}

// ─── Workflow ─────────────────────────────────────────────────────

export interface WorkflowStep {
  name: string;
  code: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  favorite: boolean;
  steps: WorkflowStep[];
  lastRun: number | null;
  runCount: number;
}

export interface WorkflowExecuteRequest {
  input?: Record<string, unknown>;
}

export interface WorkflowExecuteResponse extends ExecutionResponse {
  workflowId: string;
  workflow: string;
  result?: unknown;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export interface OrchestratorStatus {
  status: 'ok' | 'degraded';
  engineMode: string;
  activeRuns: number;
  lastRun: {
    executionId: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface OrchestratorRunRequest {
  task: string;
  input?: Record<string, unknown>;
  mode?: string;
}

export interface OrchestratorRunResponse extends ExecutionResponse {
  task: string;
  engineMode: 'auto' | 'local' | 'cloud';
}

// ─── Knowledge ────────────────────────────────────────────────────

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface KnowledgeCreateRequest {
  title: string;
  content: string;
  category?: string;
}

// ─── LightRAG ─────────────────────────────────────────────────────

export interface LightRAGStatus {
  status: 'ok' | 'degraded';
  service: 'lightrag';
  mode?: ExecutionMode;
  upstream?: unknown;
  error?: string;
}

export interface LightRAGSearchResult {
  status: 'ok' | 'degraded';
  mode: ExecutionMode;
  results: unknown[];
  message?: string;
}

export interface LightRAGIngestRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface LightRAGIngestResponse {
  status: 'ok' | 'degraded';
  mode: ExecutionMode;
  documentId: string;
  result?: unknown;
  message?: string;
}

// ─── Monitoring ───────────────────────────────────────────────────

export interface MonitoringDashboard {
  status: 'ok';
  services: Record<string, {
    status: string;
    mode?: ExecutionMode;
    uptime?: number;
  }>;
  metrics: {
    totalWorkflows: number;
    totalExecutions: number;
    activeRuns: number;
    failedRuns: number;
  };
  timestamp: string;
}

// ─── API 경로 매핑 (v2 프록시 ↔ F 서버) ─────────────────────────

export const API_CONTRACT = {
  health: {
    method: 'GET',
    path: '/api/health',
    alias: '/health',
    response: {} as HealthResponse,
  },
  workflows: {
    list: { method: 'GET', path: '/api/workflows', response: [] as Workflow[] },
    get: { method: 'GET', path: '/api/workflows/:id', response: {} as Workflow },
    create: { method: 'POST', path: '/api/workflows', response: {} as Workflow },
    delete: { method: 'DELETE', path: '/api/workflows/:id' },
    execute: { method: 'POST', path: '/api/workflows/:id/execute', response: {} as WorkflowExecuteResponse },
  },
  workflowLegacy: {
    execute: { method: 'POST', path: '/api/workflow/execute' },
  },
  orchestrator: {
    status: { method: 'GET', path: '/api/orchestrator', response: {} as OrchestratorStatus },
    run: { method: 'POST', path: '/api/orchestrator/run', response: {} as OrchestratorRunResponse },
  },
  knowledge: {
    list: { method: 'GET', path: '/api/knowledge', response: [] as KnowledgeDocument[] },
    search: { method: 'GET', path: '/api/knowledge/search', response: [] as KnowledgeDocument[] },
    create: { method: 'POST', path: '/api/knowledge', response: {} as KnowledgeDocument },
  },
  lightrag: {
    status: { method: 'GET', path: '/api/lightrag', response: {} as LightRAGStatus },
    search: { method: 'GET', path: '/api/lightrag/search', response: {} as LightRAGSearchResult },
    ingest: { method: 'POST', path: '/api/lightrag/ingest', response: {} as LightRAGIngestResponse },
  },
  monitoring: {
    dashboard: { method: 'GET', path: '/api/monitoring', response: {} as MonitoringDashboard },
    service: { method: 'GET', path: '/api/monitoring/:service' },
  },
} as const;
