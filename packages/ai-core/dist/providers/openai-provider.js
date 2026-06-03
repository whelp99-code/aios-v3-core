"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const axios_1 = __importDefault(require("axios"));
class OpenAIProvider {
    constructor(config = {}) {
        this.provider = 'openai';
        this.client = null;
        this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
        if (this.apiKey) {
            this.client = axios_1.default.create({
                baseURL: config.baseURL ?? 'https://api.openai.com/v1',
                timeout: config.timeout ?? 60000,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
        }
    }
    isConfigured() {
        return Boolean(this.apiKey && this.client);
    }
    async healthCheck() {
        if (!this.isConfigured()) {
            return { provider: 'openai', healthy: false, error: 'OPENAI_API_KEY not configured' };
        }
        const start = Date.now();
        try {
            await this.client.get('/models');
            return { provider: 'openai', healthy: true, latencyMs: Date.now() - start };
        }
        catch (error) {
            return {
                provider: 'openai',
                healthy: false,
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : 'OpenAI unreachable',
            };
        }
    }
    async chatCompletion(request) {
        if (!this.client)
            throw new Error('OpenAI provider not configured');
        const response = await this.client.post('/chat/completions', {
            ...request,
            stream: false,
        });
        return response.data;
    }
    async listModels() {
        if (!this.client)
            return [];
        const response = await this.client.get('/models');
        return response.data.data ?? [];
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai-provider.js.map