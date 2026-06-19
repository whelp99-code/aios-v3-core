import { ModelRegistry } from './model-registry';
import { ResourceAllocator } from './resource-allocator';
import { AgentRole, ChatCompletionResponse, ChatMessage, EngineMode, EnginePreferences, ModelProvider, ProviderHealth, ResourceSnapshot, RoutingDecision, TaskType } from './types';
import { ILLMProvider } from './providers/base-provider';
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
export declare class DynamicRouter {
    readonly registry: ModelRegistry;
    readonly allocator: ResourceAllocator;
    private providers;
    private preferences;
    private lastSnapshot;
    constructor(config?: DynamicRouterConfig);
    setPreferences(prefs: Partial<EnginePreferences>): void;
    getPreferences(): EnginePreferences;
    getProvider(provider: ModelProvider): ILLMProvider | undefined;
    getAllProviders(): ILLMProvider[];
    getResourceSnapshot(): Promise<ResourceSnapshot>;
    getAllProviderHealth(): Promise<ProviderHealth[]>;
    route(role: AgentRole, taskType?: TaskType): Promise<RoutingDecision>;
    /**
     * Assess task complexity for routing decisions
     * Simple: chat, basic code generation
     * Complex: reasoning, complex planning, architecture decisions
     */
    private assessTaskComplexity;
    routeAndChat(role: AgentRole, taskType: TaskType, messages: ChatMessage[], options?: Record<string, unknown>): Promise<{
        content: string;
        routing: RoutingDecision;
    }>;
    routeAndChatWithTools(role: AgentRole, taskType: TaskType, messages: ChatMessage[], tools: unknown[]): Promise<{
        message: ChatCompletionResponse['choices'][0]['message'];
        routing: RoutingDecision;
    }>;
    /** Multi-engine: route same prompt to multiple providers for consensus */
    routeMulti(role: AgentRole, taskType: TaskType, messages: ChatMessage[]): Promise<Array<{
        provider: ModelProvider;
        modelId: string;
        content: string;
        error?: string;
    }>>;
    private executeMultiTargets;
    getModelForRole(role: AgentRole): string;
    getModelForTask(taskType: TaskType): string;
    getLastResourceSnapshot(): ResourceSnapshot | null;
    private roleToTask;
    private buildFallbackChain;
    private localDecision;
    private healthyDecision;
    private firstHealthyCloudDecision;
}
export type { EngineMode, EnginePreferences, ModelProvider, RoutingDecision, ResourceSnapshot };
//# sourceMappingURL=dynamic-router.d.ts.map