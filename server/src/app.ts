import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import type { DockerExecutor } from '@aios/sandbox';
import { healthRouter } from './routes/health.js';
import { createWorkflowRouter } from './routes/workflow.js';
import { orchestratorRouter } from './routes/orchestrator.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { lightragRouter } from './routes/lightrag.js';
import { monitoringRouter } from './routes/monitoring.js';
import { aiRouter } from './routes/ai.js';
import {
  createRateLimit,
  traceIdMiddleware,
  createCorsOptions,
  idempotencyMiddleware,
} from './middleware/security.js';

export interface AppDependencies {
  workflowExecutor?: Pick<DockerExecutor, 'executeNode'>;
}

function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health' || req.path === '/health') {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    next();
    return;
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized. Valid API key required.' });
    return;
  }

  next();
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();

  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(traceIdMiddleware);
  app.use(createRateLimit({ windowMs: 60_000, max: 100 }));
  app.use(apiKeyAuth);
  app.use(idempotencyMiddleware);

  app.use(healthRouter);
  app.use(createWorkflowRouter(dependencies.workflowExecutor));
  app.use(orchestratorRouter);
  app.use(knowledgeRouter);
  app.use(lightragRouter);
  app.use(monitoringRouter);
  app.use(aiRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}),
    });
  });

  return app;
}
