"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RapidMLXProvider = void 0;
class RapidMLXProvider {
    constructor(client) {
        this.provider = 'local';
        this.client = client;
    }
    isConfigured() {
        return true;
    }
    async healthCheck() {
        const start = Date.now();
        try {
            const healthy = await this.client.healthCheck();
            return {
                provider: 'local',
                healthy,
                latencyMs: Date.now() - start,
                error: healthy ? undefined : 'Rapid-MLX not responding',
            };
        }
        catch (error) {
            return {
                provider: 'local',
                healthy: false,
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : 'Health check failed',
            };
        }
    }
    async chatCompletion(request) {
        return this.client.chatCompletion(request);
    }
    async listModels() {
        const models = await this.client.listModels();
        return models.map((m) => ({ id: m.id }));
    }
}
exports.RapidMLXProvider = RapidMLXProvider;
//# sourceMappingURL=rapid-mlx-provider.js.map