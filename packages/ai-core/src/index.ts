export { RapidMLXClient, type RapidMLXConfig } from './rapid-mlx-client';
export type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './rapid-mlx-client';

export { ModelRouter, type ModelConfig } from './model-router';
export type { TaskType, AgentRole } from './types';

export { ModelRegistry } from './model-registry';
export { DynamicRouter, type DynamicRouterConfig } from './dynamic-router';
export { ResourceAllocator } from './resource-allocator';
export type {
  EngineMode,
  EnginePreferences,
  ModelProvider,
  ModelEntry,
  RoutingDecision,
  ResourceSnapshot,
  ProviderHealth,
  RoleEngineOverride,
} from './types';

export { OpenAIProvider } from './providers/openai-provider';
export { AnthropicProvider } from './providers/anthropic-provider';
export { HuggingFaceProvider } from './providers/huggingface-provider';
export { MimoProvider } from './providers/mimo-provider';
export { RapidMLXProvider } from './providers/rapid-mlx-provider';
export type { ILLMProvider } from './providers/base-provider';
