"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HuggingFaceProvider = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Hugging Face Inference Providers — OpenAI-compatible router.
 * @see https://huggingface.co/docs/inference-providers/index
 */
class HuggingFaceProvider {
    constructor(config = {}) {
        this.provider = 'huggingface';
        this.client = null;
        this.apiKey =
            config.apiKey ??
                process.env.HF_TOKEN ??
                process.env.HUGGINGFACE_API_KEY ??
                process.env.HUGGINGFACE_HUB_TOKEN ??
                '';
        if (this.apiKey) {
            this.client = axios_1.default.create({
                baseURL: config.baseURL ?? 'https://router.huggingface.co/v1',
                timeout: config.timeout ?? 90000,
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
            return {
                provider: 'huggingface',
                healthy: false,
                error: 'HF_TOKEN / HUGGINGFACE_API_KEY not configured',
            };
        }
        const start = Date.now();
        try {
            await this.client.get('/models');
            return { provider: 'huggingface', healthy: true, latencyMs: Date.now() - start };
        }
        catch (error) {
            return {
                provider: 'huggingface',
                healthy: false,
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : 'Hugging Face router unreachable',
            };
        }
    }
    async chatCompletion(request) {
        if (!this.client)
            throw new Error('Hugging Face provider not configured');
        const model = request.model.includes(':')
            ? request.model
            : `${request.model}:fastest`;
        const response = await this.client.post('/chat/completions', {
            ...request,
            model,
            stream: false,
        });
        return response.data;
    }
    async listModels() {
        if (!this.client)
            return [];
        try {
            const response = await this.client.get('/models');
            return response.data.data ?? [];
        }
        catch {
            return [
                { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
                { id: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
                { id: 'deepseek-ai/DeepSeek-V3-0324' },
            ];
        }
    }
}
exports.HuggingFaceProvider = HuggingFaceProvider;
//# sourceMappingURL=huggingface-provider.js.map