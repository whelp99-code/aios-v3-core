import { ModelRegistry } from './model-registry';
import { ResourceAllocator } from './resource-allocator';
import {
  AgentRole,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  EngineMode,
  EnginePreferences,
  ModelProvider,
  ProviderHealth,
  ResourceSnapshot,
  RoutingDecision,
  TaskType,
} from './types';
import { ILLMProvider } from './providers/base-provider';
import { RapidMLXProvider } from './providers/rapid-mlx-provider';
import { MimoCloudProvider } from './providers/mimo-cloud-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { HuggingFaceProvider } from './providers/huggingface-provider';
import LMStudioClient from './rapid-mlx-client';

export interface DynamicRouterConfig {
  lmStudioClient?: LMStudioClient;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  huggingfaceApiKey?: string;
  mimoApiKey?: string;
  mimoBaseURL?: string;
  mimoProvider?: 'together' | 'fireworks' | 'replicate' | 'custom';
  preferences?: EnginePreferences;
  providers?: Partial<Record<ModelProvider, ILLMProvider>>;
}

export class DynamicRouter {
  readonly registry: ModelRegistry;
  readonly allocator: ResourceAllocator;

  private providers: Map<ModelProvider, ILLMProvider>;
  private preferences: EnginePreferences;
  private lastSnapshot: ResourceSnapshot | null = null;

  constructor(config: DynamicRouterConfig = {}) {
    const client =
      config.lmStudioClient ??
      new LMStudioClient({ baseURL: 'http://localhost:1234/v1', timeout: 60000 });

    this.registry = new ModelRegistry();
    this.allocator = new ResourceAllocator();
    this.providers = new Map<ModelProvider, ILLMProvider>([
      ['local', new RapidMLXProvider(client)],
      ['mimo', new MimoCloudProvider({
        apiKey: config.mimoApiKey,
        baseURL: config.mimoBaseURL,
        provider: config.mimoProvider,
      })],
      ['openai', new OpenAIProvider({ apiKey: config.openaiApiKey })],
      ['anthropic', new AnthropicProvider({ apiKey: config.anthropicApiKey })],
      ['huggingface', new HuggingFaceProvider({ apiKey: config.huggingfaceApiKey })],
    ]);
    for (const [provider, implementation] of Object.entries(config.providers ?? {})) {
      if (implementation) {
        this.providers.set(provider as ModelProvider, implementation);
      }
    }
    this.preferences = config.preferences ?? { mode: 'auto' };
  }

  setPreferences(prefs: Partial<EnginePreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  getPreferences(): EnginePreferences {
    return { ...this.preferences };
  }

  getProvider(provider: ModelProvider): ILLMProvider | undefined {
    return this.providers.get(provider);
  }

  getAllProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  async getResourceSnapshot(): Promise<ResourceSnapshot> {
    const local = this.providers.get('local')!;
    const cloud = this.getAllProviders().filter((p) => p.provider !== 'local');
    this.lastSnapshot = await this.allocator.assess(local, cloud);
    return this.lastSnapshot;
  }

  async getAllProviderHealth(): Promise<ProviderHealth[]> {
    return Promise.all(this.getAllProviders().map((p) => p.healthCheck()));
  }

  async route(role: AgentRole, taskType?: TaskType): Promise<RoutingDecision> {
    const snapshot = await this.getResourceSnapshot();
    const requestedMode = this.preferences.mode;
    const override = this.preferences.roleOverrides?.[role];
    const securityLevel = this.preferences.securityLevel ?? 'cloud_secure';

    if (
      override?.modelId &&
      override.provider &&
      (securityLevel !== 'local_only' || override.provider === 'local')
    ) {
      return {
        modelId: override.modelId,
        provider: override.provider,
        reason: `User override for role ${role}`,
      };
    }

    const task = taskType ?? this.roleToTask(role);
    const complexity = this.assessTaskComplexity(task, role);

    // Explicit local and local-only modes are hard boundaries: no cloud route or fallback.
    if (requestedMode === 'local' || securityLevel === 'local_only') {
      return this.localDecision(
        role,
        securityLevel === 'local_only' ? 'Local-only security policy' : 'Explicit local mode'
      );
    }

    if (requestedMode === 'cloud') {
      return (
        (complexity === 'complex'
          ? await this.healthyDecision(role, 'mimo', 'Complex task -> Mimo v2.5 Pro')
          : undefined) ??
        (await this.firstHealthyCloudDecision(role, 'Explicit cloud mode')) ??
        this.localDecision(role, 'Cloud unavailable, local fallback')
      );
    }

    // Auto mode: simple work stays local; complex work prefers Mimo when configured.
    if (complexity === 'complex') {
      const mimo = await this.healthyDecision(role, 'mimo', 'Complex task -> Mimo v2.5 Pro');
      if (mimo) return mimo;
    }

    if (snapshot.localHealthy && snapshot.localLoad < 0.75) {
      return this.localDecision(
        role,
        complexity === 'simple' ? 'Simple task -> LM Studio' : 'Auto: local optimal'
      );
    }

    return (
      (await this.firstHealthyCloudDecision(
        role,
        'Auto: cloud fallback (local overloaded or unavailable)'
      )) ?? this.localDecision(role, 'Default local fallback')
    );
  }

  /**
   * Assess task complexity for routing decisions
   * Simple: chat, basic code generation
   * Complex: reasoning, complex planning, architecture decisions
   */
  private assessTaskComplexity(taskType: TaskType, role: AgentRole): 'simple' | 'complex' {
    // Planner and self_corrector do reasoning/planning → complex
    if (role === 'planner' || role === 'self_corrector') return 'complex';

    // Reasoning tasks are complex
    if (taskType === 'reasoning') return 'complex';

    // Executor with code task can be simple or complex based on context
    if (role === 'executor' && taskType === 'code') {
      // For now, treat code generation as simple (can be enhanced later)
      return 'simple';
    }

    // Chat and knowledge_updater are simple
    return 'simple';
  }

  async routeAndChat(
    role: AgentRole,
    taskType: TaskType,
    messages: ChatMessage[],
    options: Record<string, unknown> = {}
  ): Promise<{ content: string; routing: RoutingDecision }> {
    const chain = await this.buildFallbackChain(role, taskType);

    for (const decision of chain) {
      try {
        const provider = this.providers.get(decision.provider);
        if (!provider?.isConfigured() && decision.provider !== 'local') continue;

        const response = await provider!.chatCompletion({
          model: decision.modelId,
          messages,
          ...options,
        });
        return {
          content: response.choices[0]?.message?.content ?? '',
          routing: decision,
        };
      } catch (error) {
        console.warn(`[DynamicRouter] ${decision.provider}/${decision.modelId} failed:`, error);
      }
    }

    throw new Error('All providers in fallback chain failed');
  }

  async routeAndChatWithTools(
    role: AgentRole,
    taskType: TaskType,
    messages: ChatMessage[],
    tools: unknown[]
  ): Promise<{ message: ChatCompletionResponse['choices'][0]['message']; routing: RoutingDecision }> {
    const decision = await this.route(role, taskType);
    const provider = this.providers.get(decision.provider)!;

    try {
      const response = await provider.chatCompletion({
        model: decision.modelId,
        messages,
        tools,
        tool_choice: 'auto',
      });
      return { message: response.choices[0].message, routing: decision };
    } catch (error) {
      if (decision.provider !== 'local') {
        const localDecision = this.localDecision(role, 'Tool-call fallback to local');
        const local = this.providers.get('local')!;
        const response = await local.chatCompletion({
          model: localDecision.modelId,
          messages,
          tools,
          tool_choice: 'auto',
        });
        return { message: response.choices[0].message, routing: localDecision };
      }
      throw error;
    }
  }

  /** Multi-engine: route same prompt to multiple providers for consensus */
  async routeMulti(
    role: AgentRole,
    taskType: TaskType,
    messages: ChatMessage[]
  ): Promise<Array<{ provider: ModelProvider; modelId: string; content: string; error?: string }>> {
    const targets: RoutingDecision[] = [];
    const primary = await this.route(role, taskType);
    targets.push(primary);

    if (this.preferences.mode === 'local' || this.preferences.securityLevel === 'local_only') {
      return this.executeMultiTargets(targets, messages);
    }

    for (const provider of ['mimo', 'openai', 'anthropic', 'huggingface', 'local'] as ModelProvider[]) {
      if (provider === primary.provider) continue;
      const p = this.providers.get(provider);
      if (!p?.isConfigured()) continue;
      const model = this.registry.getForRole(role, provider);
      if (model) targets.push({ modelId: model.modelId, provider, reason: 'Multi-consensus reviewer' });
    }

    return this.executeMultiTargets(targets, messages);
  }

  private async executeMultiTargets(
    targets: RoutingDecision[],
    messages: ChatMessage[]
  ): Promise<Array<{ provider: ModelProvider; modelId: string; content: string; error?: string }>> {
    const results = await Promise.all(
      targets.slice(0, 4).map(async (decision) => {
        try {
          const provider = this.providers.get(decision.provider)!;
          const response = await provider.chatCompletion({
            model: decision.modelId,
            messages,
          });
          return {
            provider: decision.provider,
            modelId: decision.modelId,
            content: response.choices[0]?.message?.content ?? '',
          };
        } catch (error) {
          return {
            provider: decision.provider,
            modelId: decision.modelId,
            content: '',
            error: error instanceof Error ? error.message : 'Failed',
          };
        }
      })
    );

    return results.filter((r) => r.content || r.error);
  }

  getModelForRole(role: AgentRole): string {
    const model = this.registry.getForRole(role);
    return model?.modelId ?? 'qwen3.5-9b-4bit';
  }

  getModelForTask(taskType: TaskType): string {
    const model = this.registry.getForTask(taskType)[0];
    return model?.modelId ?? 'qwen3.5-9b-4bit';
  }

  getLastResourceSnapshot(): ResourceSnapshot | null {
    return this.lastSnapshot;
  }

  private roleToTask(role: AgentRole): TaskType {
    const map: Record<AgentRole, TaskType> = {
      planner: 'reasoning',
      executor: 'code',
      critic: 'chat',
      knowledge_updater: 'chat',
      self_corrector: 'reasoning',
    };
    return map[role];
  }

  private async buildFallbackChain(role: AgentRole, taskType: TaskType): Promise<RoutingDecision[]> {
    const primary = await this.route(role, taskType);
    const chain: RoutingDecision[] = [primary];

    if (this.preferences.mode === 'local' || this.preferences.securityLevel === 'local_only') {
      return chain;
    }

    if (primary.provider !== 'local') {
      const local = this.registry.getForRole(role, 'local');
      if (local) chain.push({ modelId: local.modelId, provider: 'local', reason: 'Fallback to local' });
    }

    for (const provider of ['mimo', 'openai', 'anthropic', 'huggingface'] as ModelProvider[]) {
      if (provider === primary.provider) continue;
      const p = this.providers.get(provider);
      if (!p?.isConfigured()) continue;
      const model = this.registry.getForRole(role, provider);
      if (model) chain.push({ modelId: model.modelId, provider, reason: 'Fallback cloud provider' });
    }

    return chain;
  }

  private localDecision(role: AgentRole, reason: string): RoutingDecision {
    const model = this.registry.getForRole(role, 'local');
    return {
      modelId: model?.modelId ?? 'qwen/qwen3.5-9b',
      provider: 'local',
      reason,
    };
  }

  private async healthyDecision(
    role: AgentRole,
    provider: ModelProvider,
    reason: string
  ): Promise<RoutingDecision | undefined> {
    const implementation = this.providers.get(provider);
    if (!implementation || (provider !== 'local' && !implementation.isConfigured())) return undefined;
    const model = this.registry.getForRole(role, provider);
    if (!model) return undefined;
    const health = await implementation.healthCheck();
    if (!health.healthy) return undefined;
    return { modelId: model.modelId, provider, reason };
  }

  private async firstHealthyCloudDecision(
    role: AgentRole,
    reason: string
  ): Promise<RoutingDecision | undefined> {
    const preferred = this.preferences.preferredCloudProvider;
    const providers = [
      ...(preferred ? [preferred] : []),
      'mimo',
      'openai',
      'anthropic',
      'huggingface',
    ] as ModelProvider[];

    for (const provider of [...new Set(providers)]) {
      const decision = await this.healthyDecision(role, provider, reason);
      if (decision) return decision;
    }
    return undefined;
  }
}

export type { EngineMode, EnginePreferences, ModelProvider, RoutingDecision, ResourceSnapshot };
