"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RapidMLXClient = exports.LMStudioClient = void 0;
const axios_1 = __importDefault(require("axios"));
class LMStudioClient {
    constructor(config = { baseURL: 'http://localhost:1234/v1', timeout: 60000 }) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseURL,
            timeout: config.timeout,
        });
    }
    async chatCompletion(request) {
        try {
            const response = await this.client.post('/chat/completions', {
                ...request,
                stream: request.stream ?? false,
            });
            return response.data;
        }
        catch (error) {
            console.error('LM Studio chat completion error:', error);
            throw error;
        }
    }
    async listModels() {
        try {
            const response = await this.client.get('/models');
            return response.data.data || [];
        }
        catch (error) {
            console.error('LM Studio list models error:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const response = await this.client.get('/models');
            return response.status === 200;
        }
        catch (error) {
            console.error('LM Studio health check failed:', error);
            return false;
        }
    }
    // LM Studio의 도구 호출 복구 로직 (시뮬레이션/래퍼)
    async chatWithToolRecovery(request) {
        // LM Studio 엔진 자체에 파서가 내장되어 있으므로 기본 호출을 사용하되,
        // 필요 시 추가적인 정규화 로직을 여기에 배치할 수 있습니다.
        return this.chatCompletion(request);
    }
}
exports.LMStudioClient = LMStudioClient;
exports.RapidMLXClient = LMStudioClient;
exports.default = LMStudioClient;
//# sourceMappingURL=rapid-mlx-client.js.map