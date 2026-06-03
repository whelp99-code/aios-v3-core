import { AgentRole, ModelCapability, ModelEntry, ModelProvider, TaskType } from './types';

const DEFAULT_MODELS: ModelEntry[] = [
  {
    modelId: 'qwen3.5-9b-4bit',
    provider: 'local',
    displayName: 'Qwen 3.5 9B (Local)',
    capabilities: ['chat', 'code_generation', 'tool_use'],
    costPerToken: 0,
    latencyMs: 80,
    securityLevel: 'local_only',
    contextWindow: 32768,
    status: 'active',
  },
  {
    modelId: 'deepseek-r1-14b-4bit',
    provider: 'local',
    displayName: 'DeepSeek R1 14B (Local)',
    capabilities: ['reasoning', 'chat'],
    costPerToken: 0,
    latencyMs: 120,
    securityLevel: 'local_only',
    contextWindow: 32768,
    status: 'active',
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    capabilities: ['chat', 'code_generation', 'tool_use', 'multilingual'],
    costPerToken: 0.00000015,
    latencyMs: 400,
    securityLevel: 'cloud_secure',
    contextWindow: 128000,
    status: 'active',
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    capabilities: ['chat', 'code_generation', 'reasoning', 'tool_use', 'multilingual'],
    costPerToken: 0.000005,
    latencyMs: 600,
    securityLevel: 'cloud_secure',
    contextWindow: 128000,
    status: 'active',
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    capabilities: ['chat', 'code_generation', 'multilingual'],
    costPerToken: 0.00000025,
    latencyMs: 350,
    securityLevel: 'cloud_secure',
    contextWindow: 200000,
    status: 'active',
  },
  {
    modelId: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    capabilities: ['chat', 'code_generation', 'reasoning', 'multilingual'],
    costPerToken: 0.000003,
    latencyMs: 500,
    securityLevel: 'cloud_secure',
    contextWindow: 200000,
    status: 'active',
  },
];

const TASK_TO_CAPABILITY: Record<TaskType, ModelCapability> = {
  chat: 'chat',
  code: 'code_generation',
  reasoning: 'reasoning',
  embedding: 'embedding',
};

const ROLE_TO_TASK: Record<AgentRole, TaskType> = {
  planner: 'reasoning',
  executor: 'code',
  critic: 'chat',
  knowledge_updater: 'chat',
  self_corrector: 'reasoning',
};

export class ModelRegistry {
  private models: Map<string, ModelEntry>;

  constructor(extraModels: ModelEntry[] = []) {
    this.models = new Map();
    for (const m of [...DEFAULT_MODELS, ...extraModels]) {
      this.models.set(`${m.provider}:${m.modelId}`, m);
    }
  }

  getAll(): ModelEntry[] {
    return Array.from(this.models.values());
  }

  get(modelId: string, provider: ModelProvider): ModelEntry | undefined {
    return this.models.get(`${provider}:${modelId}`);
  }

  getByProvider(provider: ModelProvider): ModelEntry[] {
    return this.getAll().filter((m) => m.provider === provider && m.status === 'active');
  }

  getForTask(taskType: TaskType, provider?: ModelProvider): ModelEntry[] {
    const cap = TASK_TO_CAPABILITY[taskType];
    return this.getAll().filter(
      (m) =>
        m.status === 'active' &&
        m.capabilities.includes(cap) &&
        (!provider || m.provider === provider)
    );
  }

  getForRole(role: AgentRole, provider?: ModelProvider): ModelEntry | undefined {
    const taskType = ROLE_TO_TASK[role];
    const candidates = this.getForTask(taskType, provider);
    if (!candidates.length) return undefined;

    return candidates.sort((a, b) => a.costPerToken - b.costPerToken || a.latencyMs - b.latencyMs)[0];
  }

  register(model: ModelEntry): void {
    this.models.set(`${model.provider}:${model.modelId}`, model);
  }
}
