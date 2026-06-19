import express, { Request, Response, Router } from 'express';
import { A2AAgent } from './a2a-agent.js';
import { A2ATask, AgentCard } from './types.js';
import { randomUUID } from 'node:crypto';

/**
 * A2AServer - HTTP server implementing the A2A protocol endpoints
 *
 * Provides the standard A2A endpoints:
 * - GET /.well-known/agent.json - Agent discovery
 * - POST /tasks/send - Submit a task for execution
 * - GET /tasks/:id - Get task status
 * - GET /health - Health check
 */
export class A2AServer {
  private app: express.Application;
  private agent: A2AAgent;
  private port: number;
  private router: Router;

  constructor(agent: A2AAgent, port: number = 3000) {
    this.app = express();
    this.agent = agent;
    this.port = port;
    this.router = Router();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers for cross-origin agent communication
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Set up A2A protocol routes
   */
  private setupRoutes(): void {
    // GET /.well-known/agent.json - Agent discovery endpoint
    this.router.get('/.well-known/agent.json', (_req: Request, res: Response) => {
      const agentCard = this.agent.getAgentCard();
      res.json(agentCard);
    });

    // POST /tasks/send - Submit a new task
    this.router.post('/tasks/send', async (req: Request, res: Response) => {
      try {
        const { message, skillId, input, metadata } = req.body;

        if (!message && !skillId) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Either message or skillId is required',
            },
          });
          return;
        }

        const task: A2ATask = {
          id: req.body.id || randomUUID(),
          message: message || '',
          skillId,
          input,
          metadata: {
            ...metadata,
            createdAt: new Date().toISOString(),
          },
        };

        const response = await this.agent.handleTask(task);

        // Return 202 for async tasks, 200 for completed
        if (response.status === 'pending' || response.status === 'running') {
          res.status(202).json(response);
        } else {
          res.status(200).json(response);
        }
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    // GET /tasks/:id - Get task status
    this.router.get('/tasks/:id', (req: Request, res: Response) => {
      const taskId = req.params.id as string;
      const response = this.agent.getTaskStatus(taskId);
      if (!response) {
        res.status(404).json({
          error: {
            code: 'TASK_NOT_FOUND',
            message: `Task ${taskId} not found`,
          },
        });
        return;
      }
      res.json(response);
    });

    // GET /health - Health check endpoint
    this.router.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        agent: this.agent.getConfig().name,
        version: this.agent.getConfig().version,
        skills: this.agent.getRegisteredSkills(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // Mount the router
    this.app.use(this.router);
  }

  /**
   * Get the Express app (for custom middleware or testing)
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`[A2A Server] Agent "${this.agent.getConfig().name}" listening on port ${this.port}`);
        console.log(`[A2A Server] Agent card: http://localhost:${this.port}/.well-known/agent.json`);
        console.log(`[A2A Server] Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    // Express doesn't have a built-in stop, but we can track the server
    return Promise.resolve();
  }
}

/**
 * Create and start a server with an agent
 */
export async function createServer(
  agent: A2AAgent,
  port: number = 3000
): Promise<A2AServer> {
  const server = new A2AServer(agent, port);
  await server.start();
  return server;
}
