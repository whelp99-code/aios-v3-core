import { Router, type IRouter, type Request, type Response } from 'express';

export const monitoringRouter: IRouter = Router();

// Monitoring dashboard status
monitoringRouter.get('/api/monitoring', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    services: {
      'aios-server': { status: 'healthy', uptime: process.uptime() },
      'lightrag': { status: 'degraded', mode: 'simulated' },
      'orchestrator': { status: 'healthy' },
      'workflow': { status: 'healthy' },
      'ai-router': { status: 'healthy' },
    },
    metrics: {
      totalWorkflows: 0,
      totalExecutions: 0,
      activeRuns: 0,
      failedRuns: 0,
    },
    timestamp: new Date().toISOString(),
  });
});

// Monitoring service detail
monitoringRouter.get('/api/monitoring/:service', (req: Request, res: Response) => {
  const service = req.params.service as string;

  const serviceDetails: Record<string, unknown> = {
    'aios-server': {
      name: 'F-aios-v3 Server',
      status: 'healthy',
      port: process.env.PORT || 3201,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
    lightrag: {
      name: 'LightRAG',
      status: 'degraded',
      mode: 'simulated',
      serverUrl: process.env.LIGHTRAG_SERVER_URL || 'http://localhost:3300',
    },
    orchestrator: {
      name: 'Orchestrator',
      status: 'healthy',
    },
    workflow: {
      name: 'Workflow Engine',
      status: 'healthy',
    },
    'ai-router': {
      name: 'AI DynamicRouter',
      status: 'healthy',
      providers: ['local', 'mimo', 'openai', 'anthropic', 'huggingface'],
    },
  };

  const detail = (serviceDetails as Record<string, unknown>)[service];
  if (!detail) {
    res.status(404).json({ error: `Service '${service}' not found` });
    return;
  }

  res.json(detail);
});
