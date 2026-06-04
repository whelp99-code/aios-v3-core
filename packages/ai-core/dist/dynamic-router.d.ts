import { ModelRegistry } from './model-registry';
import { ResourceAllocator } from './resource-allocator';
import { AgentRole, ChatCompletionResponse, ChatMessage, EngineMode, EnginePreferences, ModelProvider, ProviderHealth, ResourceSnapshot, RoutingDecision, TaskType } from './types';
import { ILLMProvider } from './providers/base-provider';
import RapidMLXClient from './rapid-mlx-client';
export interface DynamicRouterConfig {
    rapidMLXClient?: RapidMLXClient;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    huggingfaceApiKey?: string;
    mimoApiKey?: string;
    mimoBaseURL?: string;
    googleApiKey?: string;
    googleBaseURL?: string;
    preferences?: EnginePreferences;
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
    getModelForRole(role: AgentRole): string;
    getModelForTask(taskType: TaskType): string;
    getLastResourceSnapshot(): ResourceSnapshot | null;
    private roleToTask;
    private buildFallbackChain;
    /** Gemini free tier: critic / knowledge / chat-only workloads */
    private tryGoogleSimpleRoute;
    /** UI may select google, but complex roles use paid/default cloud providers */
    private preferredCloudExcludingFreeTier;
}
export type { EngineMode, EnginePreferences, ModelProvider, RoutingDecision, ResourceSnapshot };
//# sourceMappingURL=dynamic-router.d.ts.map