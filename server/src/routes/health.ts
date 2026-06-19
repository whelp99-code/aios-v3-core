import { Router, type IRouter } from 'express';

export const healthRouter: IRouter = Router();

healthRouter.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aios-workflow-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
