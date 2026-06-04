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
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { HuggingFaceProvider } from './providers/huggingface-provider';
import { MimoProvider } from './providers/mimo-provider';
import RapidMLXClient from './rapid-mlx-client';

export interface DynamicRouterConfig {
  rapidMLXClient?: RapidMLXClient;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  huggingfaceApiKey?: string;
  mimoApiKey?: string;
  mimoBaseURL?: string;
  preferences?: EnginePreferences;
}

export class DynamicRouter {
  readonly registry: ModelRegistry;
  readonly allocator: ResourceAllocator;

  private providers: Map<ModelProvider, ILLMProvider>;
  private preferences: EnginePreferences;
  private lastSnapshot: ResourceSnapshot | null = null;

  constructor(config: DynamicRouterConfig = {}) {
    const client =
      config.rapidMLXClient ??
      new RapidMLXClient({ baseURL: 'http://localhost:8000/v1', timeout: 60000 });

    this.registry = new ModelRegistry();
    this.allocator = new ResourceAllocator();
    this.providers = new Map<ModelProvider, ILLMProvider>([
      ['local', new RapidMLXProvider(client)],
      ['openai', new OpenAIProvider({ apiKey: config.openaiApiKey })],
      ['anthropic', new AnthropicProvider({ apiKey: config.anthropicApiKey })],
      ['huggingface', new HuggingFaceProvider({ apiKey: config.huggingfaceApiKey })],
      [
        'mimo',
        new MimoProvider({
          apiKey: config.mimoApiKey,
          baseURL: config.mimoBaseURL,
        }),
      ],
    ]);
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
    const effectiveMode = this.allocator.resolveMode(this.preferences.mode, snapshot);
    const override = this.preferences.roleOverrides?.[role];

    if (override?.modelId && override.provider) {
      return {
        modelId: override.modelId,
        provider: override.provider,
        reason: `User override for role ${role}`,
      };
    }

    const security = this.preferences.securityLevel ?? 'cloud_secure';
    const task = taskType ?? this.roleToTask(role);

    if (effectiveMode === 'local' || security === 'local_only') {
      const model = this.registry.getForRole(role, 'local');
      if (model && (await this.providers.get('local')!.healthCheck()).healthy) {
        return { modelId: model.modelId, provider: 'local', reason: 'Local-first policy' };
      }
    }

    if (effectiveMode === 'cloud' || !snapshot.localHealthy) {
      const cloudProvider = this.allocator.pickCloudProvider(
        this.getAllProviders(),
        this.preferences.preferredCloudProvider
      );
      if (cloudProvider) {
        const model = this.registry.getForRole(role, cloudProvider.provider);
        if (model) {
          return {
            modelId: model.modelId,
            provider: cloudProvider.provider,
            reason: snapshot.localHealthy ? 'Cloud mode selected' : 'Local unavailable, cloud fallback',
          };
        }
      }
    }

    // Auto: prefer local if healthy and not overloaded
    if (snapshot.localHealthy && snapshot.localLoad < 0.75) {
      const model = this.registry.getForRole(role, 'local');
      if (model) {
        return { modelId: model.modelId, provider: 'local', reason: 'Auto: local optimal' };
      }
    }

    const cloudProvider = this.allocator.pickCloudProvider(
      this.getAllProviders(),
      this.preferences.preferredCloudProvider
    );
    if (cloudProvider?.isConfigured()) {
      const model = this.registry.getForRole(role, cloudProvider.provider);
      if (model) {
        return {
          modelId: model.modelId,
          provider: cloudProvider.provider,
          reason: 'Auto: cloud fallback (local overloaded or unavailable)',
        };
      }
    }

    const fallback = this.registry.getForRole(role, 'local');
    return {
      modelId: fallback?.modelId ?? 'qwen3.5-9b-4bit',
      provider: 'local',
      reason: 'Default fallback',
    };
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
        const localDecision = await this.route(role, taskType);
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

    for (const provider of ['mimo', 'openai', 'anthropic', 'huggingface', 'local'] as ModelProvider[]) {
      if (provider === primary.provider) continue;
      const p = this.providers.get(provider);
      if (!p?.isConfigured()) continue;
      const model = this.registry.getForRole(role, provider);
      if (model) targets.push({ modelId: model.modelId, provider, reason: 'Multi-consensus reviewer' });
    }

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
}

export type { EngineMode, EnginePreferences, ModelProvider, RoutingDecision, ResourceSnapshot };
