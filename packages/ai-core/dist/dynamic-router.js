"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicRouter = void 0;
const model_registry_1 = require("./model-registry");
const resource_allocator_1 = require("./resource-allocator");
const rapid_mlx_provider_1 = require("./providers/rapid-mlx-provider");
const openai_provider_1 = require("./providers/openai-provider");
const anthropic_provider_1 = require("./providers/anthropic-provider");
const rapid_mlx_client_1 = __importDefault(require("./rapid-mlx-client"));
class DynamicRouter {
    constructor(config = {}) {
        this.lastSnapshot = null;
        const client = config.rapidMLXClient ??
            new rapid_mlx_client_1.default({ baseURL: 'http://localhost:8000/v1', timeout: 60000 });
        this.registry = new model_registry_1.ModelRegistry();
        this.allocator = new resource_allocator_1.ResourceAllocator();
        this.providers = new Map([
            ['local', new rapid_mlx_provider_1.RapidMLXProvider(client)],
            ['openai', new openai_provider_1.OpenAIProvider({ apiKey: config.openaiApiKey })],
            ['anthropic', new anthropic_provider_1.AnthropicProvider({ apiKey: config.anthropicApiKey })],
        ]);
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
            if (model && (await this.providers.get('local').healthCheck()).healthy) {
                return { modelId: model.modelId, provider: 'local', reason: 'Local-first policy' };
            }
        }
        if (effectiveMode === 'cloud' || !snapshot.localHealthy) {
            const cloudProvider = this.allocator.pickCloudProvider(this.getAllProviders(), this.preferences.preferredCloudProvider);
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
        const cloudProvider = this.allocator.pickCloudProvider(this.getAllProviders(), this.preferences.preferredCloudProvider);
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
                const localDecision = await this.route(role, taskType);
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
        for (const provider of ['openai', 'anthropic', 'local']) {
            if (provider === primary.provider)
                continue;
            const p = this.providers.get(provider);
            if (!p?.isConfigured())
                continue;
            const model = this.registry.getForRole(role, provider);
            if (model)
                targets.push({ modelId: model.modelId, provider, reason: 'Multi-consensus reviewer' });
        }
        const results = await Promise.all(targets.slice(0, 3).map(async (decision) => {
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
        if (primary.provider !== 'local') {
            const local = this.registry.getForRole(role, 'local');
            if (local)
                chain.push({ modelId: local.modelId, provider: 'local', reason: 'Fallback to local' });
        }
        for (const provider of ['openai', 'anthropic']) {
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
}
exports.DynamicRouter = DynamicRouter;
//# sourceMappingURL=dynamic-router.js.map