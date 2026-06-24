export type TaskType = 'chat' | 'code' | 'reasoning' | 'embedding';
export type AgentRole = 'planner' | 'executor' | 'critic' | 'self_corrector' | 'knowledge_updater';
export type EngineMode = 'local' | 'cloud' | 'auto';
export type ModelProvider = 'local' | 'mimo' | 'openai' | 'anthropic' | 'huggingface';
export type SecurityLevel = 'local_only' | 'cloud_secure';
export type ModelCapability = 'chat' | 'code_generation' | 'reasoning' | 'embedding' | 'tool_use' | 'multilingual';
export interface EnginePreferences {
    mode: EngineMode;
    securityLevel?: SecurityLevel;
    preferredCloudProvider?: ModelProvider;
    roleOverrides?: Partial<Record<AgentRole, RoleEngineOverride>>;
}
export interface RoleEngineOverride {
    provider: ModelProvider;
    modelId: string;
}
export interface ModelEntry {
    modelId: string;
    provider: ModelProvider;
    roles?: AgentRole[];
    maxTokens?: number;
    contextWindow?: number;
    displayName?: string;
    status?: 'active' | 'deprecated' | 'beta';
    capabilities?: string[];
    costPerToken?: number;
    latencyMs?: number;
    securityLevel?: SecurityLevel;
}
export interface RoutingDecision {
    modelId: string;
    provider: ModelProvider;
    reason: string;
}
export interface ResourceSnapshot {
    localHealthy: boolean;
    localLoad: number;
    cloudAvailable: boolean;
    recommendedMode?: EngineMode;
}
export interface ProviderHealth {
    provider: ModelProvider;
    healthy: boolean;
    latencyMs?: number;
    error?: string;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    tools?: unknown[];
    tool_choice?: string;
}
export interface ChatCompletionResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
            tool_calls?: unknown[];
        };
        index?: number;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
//# sourceMappingURL=types.d.ts.map