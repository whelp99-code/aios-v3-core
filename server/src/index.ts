import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { workflowRouter } from './routes/workflow.js';

// API 키 인증 미들웨어
function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // 헬스체크는 인증 불필요
  if (req.path === '/api/health') {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.API_KEY;

  // API_KEY가 설정되지 않은 경우 인증 우회 (개발 환경)
  if (!expectedKey) {
    next();
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized. Valid API key required.' });
    return;
  }

  next();
}

const app: Express = express();
const PORT = process.env.PORT || 3201;

// Middleware
app.use(cors());
app.use(express.json());
app.use(apiKeyAuth);

// Routes
app.use(healthRouter);
app.use(workflowRouter);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Workflow API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
