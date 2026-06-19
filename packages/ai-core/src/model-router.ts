import LMStudioClient from './rapid-mlx-client';
import { DynamicRouter, DynamicRouterConfig } from './dynamic-router';
import { AgentRole, TaskType } from './types';

export type { TaskType, AgentRole } from './types';

export interface ModelConfig {
  chat: string;
  code: string;
  reasoning: string;
  embedding: string;
}

/** Backward-compatible wrapper — delegates to DynamicRouter */
export class ModelRouter {
  private router: DynamicRouter;
  private modelConfig: ModelConfig;

  constructor(client: LMStudioClient, config?: Partial<ModelConfig>, router?: DynamicRouter) {
    this.router = router ?? new DynamicRouter({ lmStudioClient: client });
    this.modelConfig = {
      chat: config?.chat || 'qwen3.5-9b-4bit',
      code: config?.code || 'qwen3.5-9b-4bit',
      reasoning: config?.reasoning || 'deepseek-r1-14b-4bit',
      embedding: config?.embedding || 'nomic-embed-text',
    };
  }

  getDynamicRouter(): DynamicRouter {
    return this.router;
  }

  getModelForTask(taskType: TaskType): string {
    return this.modelConfig[taskType] ?? this.router.getModelForTask(taskType);
  }

  getModelForRole(role: AgentRole): string {
    return this.router.getModelForRole(role);
  }

  async routeAndChat(taskType: TaskType, messages: unknown[], options: Record<string, unknown> = {}): Promise<string> {
    const role = this.taskToRole(taskType);
    const result = await this.router.routeAndChat(
      role,
      taskType,
      messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
      options
    );
    console.log(`[ModelRouter] ${result.routing.provider}/${result.routing.modelId} — ${result.routing.reason}`);
    return result.content;
  }

  async routeAndChatWithTools(taskType: TaskType, messages: unknown[], tools: unknown[]): Promise<unknown> {
    const role = this.taskToRole(taskType);
    const result = await this.router.routeAndChatWithTools(
      role,
      taskType,
      messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
      tools
    );
    return result.message;
  }

  private taskToRole(taskType: TaskType): AgentRole {
    const map: Record<TaskType, AgentRole> = {
      chat: 'critic',
      code: 'executor',
      reasoning: 'planner',
      embedding: 'knowledge_updater',
    };
    return map[taskType];
  }
}

export default ModelRouter;
