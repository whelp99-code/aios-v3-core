"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMCPAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
class BaseMCPAdapter {
    constructor(config) {
        this.status = 'disconnected';
        this.config = {
            timeout: 10000,
            simulateWhenUnavailable: true,
            ...config,
        };
        this.client = axios_1.default.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
        });
    }
    get id() {
        return this.config.id;
    }
    get name() {
        return this.config.name;
    }
    async healthCheck() {
        const tools = this.getTools().map((t) => t.function.name);
        const now = new Date().toISOString();
        if (!this.config.baseURL) {
            this.status = 'simulated';
            return {
                id: this.id,
                name: this.name,
                status: 'simulated',
                lastChecked: now,
                tools,
            };
        }
        try {
            await this.client.get('/health', { timeout: 5000 });
            this.status = 'connected';
            return {
                id: this.id,
                name: this.name,
                status: 'connected',
                endpoint: this.config.baseURL,
                lastChecked: now,
                tools,
            };
        }
        catch {
            if (this.config.simulateWhenUnavailable) {
                this.status = 'simulated';
                return {
                    id: this.id,
                    name: this.name,
                    status: 'simulated',
                    endpoint: this.config.baseURL,
                    lastChecked: now,
                    tools,
                    error: 'External service unavailable, using simulation mode',
                };
            }
            this.status = 'error';
            return {
                id: this.id,
                name: this.name,
                status: 'error',
                endpoint: this.config.baseURL,
                lastChecked: now,
                tools,
                error: 'Connection failed',
            };
        }
    }
    async callTool(call) {
        const start = Date.now();
        try {
            const result = await this.executeTool(call);
            return {
                toolCallId: call.id,
                toolName: call.name,
                adapterId: this.id,
                success: true,
                result,
                durationMs: Date.now() - start,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (this.config.simulateWhenUnavailable) {
                const simulated = this.simulateTool(call);
                return {
                    toolCallId: call.id,
                    toolName: call.name,
                    adapterId: this.id,
                    success: true,
                    result: simulated,
                    durationMs: Date.now() - start,
                };
            }
            return {
                toolCallId: call.id,
                toolName: call.name,
                adapterId: this.id,
                success: false,
                result: null,
                error: message,
                durationMs: Date.now() - start,
            };
        }
    }
}
exports.BaseMCPAdapter = BaseMCPAdapter;
//# sourceMappingURL=base-adapter.js.map