"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicRouter = void 0;
const model_registry_1 = require("./model-registry");
const resource_allocator_1 = require("./resource-allocator");
const rapid_mlx_provider_1 = require("./providers/rapid-mlx-provider");
const mimo_cloud_provider_1 = require("./providers/mimo-cloud-provider");
const openai_provider_1 = require("./providers/openai-provider");
const anthropic_provider_1 = require("./providers/anthropic-provider");
const huggingface_provider_1 = require("./providers/huggingface-provider");
const rapid_mlx_client_1 = __importDefault(require("./rapid-mlx-client"));
class DynamicRouter {
    constructor(config = {}) {
        this.lastSnapshot = null;
        const client = config.lmStudioClient ??
            new rapid_mlx_client_1.default({ baseURL: 'http://localhost:1234/v1', timeout: 60000 });
        this.registry = new model_registry_1.ModelRegistry();
        this.allocator = new resource_allocator_1.ResourceAllocator();
        this.providers = new Map([
            ['local', new rapid_mlx_provider_1.RapidMLXProvider(client)],
            ['mimo', new mimo_cloud_provider_1.MimoCloudProvider({
                    apiKey: config.mimoApiKey,
                    baseURL: config.mimoBaseURL,
                    provider: config.mimoProvider,
                })],
            ['openai', new openai_provider_1.OpenAIProvider({ apiKey: config.openaiApiKey })],
            ['anthropic', new anthropic_provider_1.AnthropicProvider({ apiKey: config.anthropicApiKey })],
            ['huggingface', new huggingface_provider_1.HuggingFaceProvider({ apiKey: config.huggingfaceApiKey })],
        ]);
        for (const [provider, implementation] of Object.entries(config.providers ?? {})) {
            if (implementation) {
                this.providers.set(provider, implementation);
            }
        }
        this.preferences = config.preferences ?? { mode: 'auto' };
    }
    setPreferences(prefs) {
        this.preferences = { ...this.preferences, ...prefs };
    }
    getPreferences() {
        return { ...this.preferences };
    }
    getProvider(provider) {
        return this.providers.get(provider);
    }
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    async getResourceSnapshot() {
        const local = this.providers.get('local');
        const cloud = this.getAllProviders().filter((p) => p.provider !== 'local');
        this.lastSnapshot = await this.allocator.assess(local, cloud);
        return this.lastSnapshot;
    }
    async getAllProviderHealth() {
        return Promise.all(this.getAllProviders().map((p) => p.healthCheck()));
    }
    async route(role, taskType) {
        const snapshot = await this.getResourceSnapshot();
        const requestedMode = this.preferences.mode;
        const override = this.preferences.roleOverrides?.[role];
        const securityLevel = this.preferences.securityLevel ?? 'cloud_secure';
        if (override?.modelId &&
            override.provider &&
            (securityLevel !== 'local_only' || override.provider === 'local')) {
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
            return this.localDecision(role, securityLevel === 'local_only' ? 'Local-only security policy' : 'Explicit local mode');
        }
        if (requestedMode === 'cloud') {
            return ((complexity === 'complex'
                ? await this.healthyDecision(role, 'mimo', 'Complex task -> Mimo v2.5 Pro')
                : undefined) ??
                (await this.firstHealthyCloudDecision(role, 'Explicit cloud mode')) ??
                this.localDecision(role, 'Cloud unavailable, local fallback'));
        }
        // Auto mode: simple work stays local; complex work prefers Mimo when configured.
        if (complexity === 'complex') {
            const mimo = await this.healthyDecision(role, 'mimo', 'Complex task -> Mimo v2.5 Pro');
            if (mimo)
                return mimo;
        }
        if (snapshot.localHealthy && snapshot.localLoad < 0.75) {
            return this.localDecision(role, complexity === 'simple' ? 'Simple task -> LM Studio' : 'Auto: local optimal');
        }
        return ((await this.firstHealthyCloudDecision(role, 'Auto: cloud fallback (local overloaded or unavailable)')) ?? this.localDecision(role, 'Default local fallback'));
    }
    /**
     * Assess task complexity for routing decisions
     * Simple: chat, basic code generation
     * Complex: reasoning, complex planning, architecture decisions
     */
    assessTaskComplexity(taskType, role) {
        // Planner and self_corrector do reasoning/planning → complex
        if (role === 'planner' || role === 'self_corrector')
            return 'complex';
        // Reasoning tasks are complex
        if (taskType === 'reasoning')
            return 'complex';
        // Executor with code task can be simple or complex based on context
        if (role === 'executor' && taskType === 'code') {
            // For now, treat code generation as simple (can be enhanced later)
            return 'simple';
        }
        // Chat and knowledge_updater are simple
        return 'simple';
    }
    async routeAndChat(role, taskType, messages, options = {}) {
        const chain = await this.buildFallbackChain(role, taskType);
        for (const decision of chain) {
            try {
                const provider = this.providers.get(decision.provider);
                if (!provider?.isConfigured() && decision.provider !== 'local')
                    continue;
                const response = await provider.chatCompletion({
                    model: decision.modelId,
                    messages,
                    ...options,
                });
                return {
                    content: response.choices[0]?.message?.content ?? '',
                    routing: decision,
                };
            }
            catch (error) {
                console.warn(`[DynamicRouter] ${decision.provider}/${decision.modelId} failed:`, error);
            }
        }
        throw new Error('All providers in fallback chain failed');
    }
    async routeAndChatWithTools(role, taskType, messages, tools) {
        const decision = await this.route(role, taskType);
        const provider = this.providers.get(decision.provider);
        try {
            const response = await provider.chatCompletion({
                model: decision.modelId,
                messages,
                tools,
                tool_choice: 'auto',
            });
            return { message: response.choices[0].message, routing: decision };
        }
        catch (error) {
            if (decision.provider !== 'local') {
                const localDecision = this.localDecision(role, 'Tool-call fallback to local');
                const local = this.providers.get('local');
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
    async routeMulti(role, taskType, messages) {
        const targets = [];
        const primary = await this.route(role, taskType);
        targets.push(primary);
        if (this.preferences.mode === 'local' || this.preferences.securityLevel === 'local_only') {
            return this.executeMultiTargets(targets, messages);
        }
        for (const provider of ['mimo', 'openai', 'anthropic', 'huggingface', 'local']) {
            if (provider === primary.provider)
                continue;
            const p = this.providers.get(provider);
            if (!p?.isConfigured())
                continue;
            const model = this.registry.getForRole(role, provider);
            if (model)
                targets.push({ modelId: model.modelId, provider, reason: 'Multi-consensus reviewer' });
        }
        return this.executeMultiTargets(targets, messages);
    }
    async executeMultiTargets(targets, messages) {
        const results = await Promise.all(targets.slice(0, 4).map(async (decision) => {
            try {
                const provider = this.providers.get(decision.provider);
                const response = await provider.chatCompletion({
                    model: decision.modelId,
                    messages,
                });
                return {
                    provider: decision.provider,
                    modelId: decision.modelId,
                    content: response.choices[0]?.message?.content ?? '',
                };
            }
            catch (error) {
                return {
                    provider: decision.provider,
                    modelId: decision.modelId,
                    content: '',
                    error: error instanceof Error ? error.message : 'Failed',
                };
            }
        }));
        return results.filter((r) => r.content || r.error);
    }
    getModelForRole(role) {
        const model = this.registry.getForRole(role);
        return model?.modelId ?? 'qwen3.5-9b-4bit';
    }
    getModelForTask(taskType) {
        const model = this.registry.getForTask(taskType)[0];
        return model?.modelId ?? 'qwen3.5-9b-4bit';
    }
    getLastResourceSnapshot() {
        return this.lastSnapshot;
    }
    roleToTask(role) {
        const map = {
            planner: 'reasoning',
            executor: 'code',
            critic: 'chat',
            knowledge_updater: 'chat',
            self_corrector: 'reasoning',
        };
        return map[role];
    }
    async buildFallbackChain(role, taskType) {
        const primary = await this.route(role, taskType);
        const chain = [primary];
        if (this.preferences.mode === 'local' || this.preferences.securityLevel === 'local_only') {
            return chain;
        }
        if (primary.provider !== 'local') {
            const local = this.registry.getForRole(role, 'local');
            if (local)
                chain.push({ modelId: local.modelId, provider: 'local', reason: 'Fallback to local' });
        }
        for (const provider of ['mimo', 'openai', 'anthropic', 'huggingface']) {
            if (provider === primary.provider)
                continue;
            const p = this.providers.get(provider);
            if (!p?.isConfigured())
                continue;
            const model = this.registry.getForRole(role, provider);
            if (model)
                chain.push({ modelId: model.modelId, provider, reason: 'Fallback cloud provider' });
        }
        return chain;
    }
    localDecision(role, reason) {
        const model = this.registry.getForRole(role, 'local');
        return {
            modelId: model?.modelId ?? 'qwen/qwen3.5-9b',
            provider: 'local',
            reason,
        };
    }
    async healthyDecision(role, provider, reason) {
        const implementation = this.providers.get(provider);
        if (!implementation || (provider !== 'local' && !implementation.isConfigured()))
            return undefined;
        const model = this.registry.getForRole(role, provider);
        if (!model)
            return undefined;
        const health = await implementation.healthCheck();
        if (!health.healthy)
            return undefined;
        return { modelId: model.modelId, provider, reason };
    }
    async firstHealthyCloudDecision(role, reason) {
        const preferred = this.preferences.preferredCloudProvider;
        const providers = [
            ...(preferred ? [preferred] : []),
            'mimo',
            'openai',
            'anthropic',
            'huggingface',
        ];
        for (const provider of [...new Set(providers)]) {
            const decision = await this.healthyDecision(role, provider, reason);
            if (decision)
                return decision;
        }
        return undefined;
    }
}
exports.DynamicRouter = DynamicRouter;
//# sourceMappingURL=dynamic-router.js.map