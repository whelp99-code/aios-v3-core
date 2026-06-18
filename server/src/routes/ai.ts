import { Router, type IRouter, type Request, type Response } from 'express';
import {
  DynamicRouter,
  type AgentRole,
  type EngineMode,
  type SecurityLevel,
  type TaskType,
} from '@aios/ai-core';

export const aiRouter: IRouter = Router();

// DynamicRouter singleton (Phase 3: unified AI routing)
let dynamicRouter: DynamicRouter | null = null;

function readEngineMode(value: string | undefined): EngineMode {
  return value === 'local' || value === 'cloud' || value === 'auto' ? value : 'auto';
}

function readSecurityLevel(value: string | undefined): SecurityLevel {
  return value === 'local_only' || value === 'cloud_secure' ? value : 'cloud_secure';
}

function getDynamicRouter(): DynamicRouter {
  if (!dynamicRouter) {
    dynamicRouter = new DynamicRouter({
      mimoApiKey: process.env.MIMO_API_KEY,
      mimoBaseURL: process.env.MIMO_BASE_URL,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
      preferences: {
        mode: readEngineMode(process.env.AI_ENGINE_MODE),
        securityLevel: readSecurityLevel(process.env.AI_SECURITY_LEVEL),
      },
    });
  }
  return dynamicRouter;
}

// AI status
aiRouter.get('/api/ai/status', async (_req: Request, res: Response) => {
  try {
    const router = getDynamicRouter();
    const health = await router.getAllProviderHealth();
    const snapshot = await router.getResourceSnapshot();
    res.json({
      status: 'ok',
      providers: health,
      snapshot,
      preferences: router.getPreferences(),
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      error: error instanceof Error ? error.message : 'AI router unavailable',
    });
  }
});

// AI chat completion
aiRouter.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { role, taskType, messages, options } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Required field: messages (non-empty array)' });
      return;
    }

    const router = getDynamicRouter();
    const agentRole: AgentRole = role || 'executor';
    const task: TaskType = taskType || 'chat';

    const result = await router.routeAndChat(agentRole, task, messages, options || {});

    res.json({
      status: 'ok',
      mode: 'live',
      content: result.content,
      routing: result.routing,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'AI chat failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// AI routing decision
aiRouter.post('/api/ai/route', async (req: Request, res: Response) => {
  try {
    const { role, taskType } = req.body;
    const router = getDynamicRouter();
    const decision = await router.route(role || 'executor', taskType);
    res.json({
      status: 'ok',
      decision,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Routing failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// AI model info
aiRouter.get('/api/ai/models', (_req: Request, res: Response) => {
  const router = getDynamicRouter();
  const models = router.registry.getAll();
  res.json({
    status: 'ok',
    models: models.map(m => ({
      modelId: m.modelId,
      provider: m.provider,
      displayName: m.displayName,
      status: m.status,
    })),
  });
});
