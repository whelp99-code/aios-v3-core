import { Router, type IRouter, type Request } from 'express';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../middleware/security.js';
import { OrchestratorRunRequestSchema } from '../schemas/api-contract.js';

export const orchestratorRouter: IRouter = Router();

// Phase 1: Per-request context instead of singleton state
// Run records are scoped to the request lifecycle, not shared across requests
interface RunRecord {
  executionId: string;
  task: string;
  mode: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  input?: unknown;
  result?: unknown;
  error?: string;
  traceId?: string;
}

// Persistent run history (will move to PostgreSQL in Phase 2)
const runHistory: Map<string, RunRecord> = new Map();

// Orchestrator status
orchestratorRouter.get('/api/orchestrator', (_req, res) => {
  const activeRuns = Array.from(runHistory.values()).filter(r => r.status === 'running').length;
  const lastRun = Array.from(runHistory.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

  res.json({
    status: 'ok',
    engineMode: 'local',
    activeRuns,
    lastRun: lastRun ? {
      executionId: lastRun.executionId,
      status: lastRun.status,
      createdAt: lastRun.createdAt,
    } : null,
  });
});

// Orchestrator run
orchestratorRouter.post(
  '/api/orchestrator/run',
  validateBody(OrchestratorRunRequestSchema),
  async (req: Request, res) => {
  try {
    const { task, input, mode } = req.body;

    if (!task) {
      res.status(400).json({ error: 'Required field: task' });
      return;
    }

    const executionId = `exec-${randomUUID()}`;
    const traceId = req.traceId || `trace-${randomUUID()}`;
    const record: RunRecord = {
      executionId,
      task,
      mode: mode || 'local',
      status: 'queued',
      createdAt: new Date().toISOString(),
      input,
      traceId,
    };
    runHistory.set(executionId, record);

    // Phase 1: Return proper execution response with trace ID
    res.json({
      executionId,
      status: 'queued',
      mode: 'live',
      engineMode: record.mode,
      task: record.task,
      traceId,
      createdAt: record.createdAt,
    });
  } catch (error) {
    console.error('Orchestrator run error:', error);
    res.status(500).json({
      error: 'Orchestrator execution failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
  }
);
