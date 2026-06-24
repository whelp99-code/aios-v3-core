"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const axios_1 = __importDefault(require("axios"));
class AnthropicProvider {
    constructor(config = {}) {
        this.provider = 'anthropic';
        this.client = null;
        this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
        if (this.apiKey) {
            this.client = axios_1.default.create({
                baseURL: config.baseURL ?? 'https://api.anthropic.com/v1',
                timeout: config.timeout ?? 60000,
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
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
            return { provider: 'anthropic', healthy: false, error: 'ANTHROPIC_API_KEY not configured' };
        }
        return { provider: 'anthropic', healthy: true, latencyMs: 0 };
    }
    async chatCompletion(request) {
        if (!this.client)
            throw new Error('Anthropic provider not configured');
        const systemMsg = request.messages.find((m) => m.role === 'system');
        const nonSystem = request.messages.filter((m) => m.role !== 'system');
        const response = await this.client.post('/messages', {
            model: request.model,
            max_tokens: request.max_tokens ?? 4096,
            system: systemMsg?.content,
            messages: nonSystem.map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
        });
        const text = response.data.content.map((c) => c.text).join('\\n');
        return {
            id: response.data.id,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: response.data.model,
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content: text },
                },
            ],
            usage: {
                prompt_tokens: response.data.usage.input_tokens,
                completion_tokens: response.data.usage.output_tokens,
                total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
            },
        };
    }
    async listModels() {
        return [
            { id: 'claude-3-5-haiku-20241022' },
            { id: 'claude-3-5-sonnet-20241022' },
        ];
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic-provider.js.map