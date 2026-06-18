import { AgentRole, ModelCapability, ModelEntry, ModelProvider, TaskType } from './types';

const DEFAULT_MODELS: ModelEntry[] = [
  {
    modelId: 'qwen/qwen3.5-9b',
    provider: 'local',
    displayName: 'Qwen 3.5 9B (LM Studio)',
    capabilities: ['chat', 'code_generation', 'tool_use'],
    costPerToken: 0,
    latencyMs: 80,
    securityLevel: 'local_only',
    contextWindow: 32768,
    status: 'active',
  },
  {
    modelId: 'google/gemma-4-26b-a4b',
    provider: 'local',
    displayName: 'Gemma 4 26B (LM Studio)',
    capabilities: ['reasoning', 'chat'],
    costPerToken: 0,
    latencyMs: 120,
    securityLevel: 'local_only',
    contextWindow: 32768,
    status: 'active',
  },
  {
    modelId: 'text-embedding-nomic-embed-text-v1.5',
    provider: 'local',
    displayName: 'Nomic Embed Text (LM Studio)',
    capabilities: ['embedding'],
    costPerToken: 0,
    latencyMs: 50,
    securityLevel: 'local_only',
    contextWindow: 8192,
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
  {
    modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    provider: 'huggingface',
    displayName: 'Llama 3.1 8B (HF Router)',
    capabilities: ['chat', 'multilingual', 'tool_use'],
    costPerToken: 0.00000008,
    latencyMs: 450,
    securityLevel: 'cloud_secure',
    contextWindow: 128000,
    status: 'active',
  },
  {
    modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    provider: 'huggingface',
    displayName: 'Qwen 2.5 Coder 32B (HF Router)',
    capabilities: ['chat', 'code_generation', 'tool_use'],
    costPerToken: 0.0000002,
    latencyMs: 700,
    securityLevel: 'cloud_secure',
    contextWindow: 32768,
    status: 'active',
  },
  {
    modelId: 'deepseek-ai/DeepSeek-V3-0324',
    provider: 'huggingface',
    displayName: 'DeepSeek V3 (HF Router)',
    capabilities: ['chat', 'reasoning', 'code_generation', 'multilingual'],
    costPerToken: 0.0000003,
    latencyMs: 800,
    securityLevel: 'cloud_secure',
    contextWindow: 64000,
    status: 'active',
  },
  {
    modelId: 'mimo-v2.5-pro',
    provider: 'mimo',
    displayName: 'Mimo v2.5 Pro (Cloud)',
    capabilities: ['chat', 'code_generation', 'reasoning', 'tool_use', 'multilingual'],
    costPerToken: 0.000001,
    latencyMs: 600,
    securityLevel: 'cloud_secure',
    contextWindow: 128000,
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
