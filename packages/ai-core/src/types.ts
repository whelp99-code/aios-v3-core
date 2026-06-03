export type TaskType = 'chat' | 'code' | 'reasoning' | 'embedding';

export type AgentRole =
  | 'planner'
  | 'executor'
  | 'critic'
  | 'knowledge_updater'
  | 'self_corrector';

export type ModelProvider = 'local' | 'openai' | 'anthropic' | 'huggingface';

export type EngineMode = 'auto' | 'local' | 'cloud';

export type ModelCapability =
  | 'chat'
  | 'code_generation'
  | 'reasoning'
  | 'embedding'
  | 'tool_use'
  | 'multilingual';

export type SecurityLevel = 'local_only' | 'cloud_secure';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: unknown[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelEntry {
  modelId: string;
  provider: ModelProvider;
  displayName: string;
  capabilities: ModelCapability[];
  costPerToken: number;
  latencyMs: number;
  securityLevel: SecurityLevel;
  contextWindow: number;
  status: 'active' | 'deprecated' | 'maintenance';
}

export interface RoleEngineOverride {
  provider?: ModelProvider;
  modelId?: string;
}

export interface EnginePreferences {
  mode: EngineMode;
  securityLevel?: SecurityLevel;
  roleOverrides?: Partial<Record<AgentRole, RoleEngineOverride>>;
  preferredCloudProvider?: 'openai' | 'anthropic' | 'huggingface';
}

export interface RoutingDecision {
  modelId: string;
  provider: ModelProvider;
  reason: string;
}

export interface ProviderHealth {
  provider: ModelProvider;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ResourceSnapshot {
  localLoad: number;
  localHealthy: boolean;
  recommendedMode: EngineMode;
  cloudAvailable: boolean;
}
