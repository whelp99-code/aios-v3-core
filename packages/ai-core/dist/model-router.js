"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = void 0;
const dynamic_router_1 = require("./dynamic-router");
/** Backward-compatible wrapper — delegates to DynamicRouter */
class ModelRouter {
    constructor(client, config, router) {
        this.router = router ?? new dynamic_router_1.DynamicRouter({ lmStudioClient: client });
        this.modelConfig = {
            chat: config?.chat || 'qwen3.5-9b-4bit',
            code: config?.code || 'qwen3.5-9b-4bit',
            reasoning: config?.reasoning || 'deepseek-r1-14b-4bit',
            embedding: config?.embedding || 'nomic-embed-text',
        };
    }
    getDynamicRouter() {
        return this.router;
    }
    getModelForTask(taskType) {
        return this.modelConfig[taskType] ?? this.router.getModelForTask(taskType);
    }
    getModelForRole(role) {
        return this.router.getModelForRole(role);
    }
    async routeAndChat(taskType, messages, options = {}) {
        const role = this.taskToRole(taskType);
        const result = await this.router.routeAndChat(role, taskType, messages, options);
        console.log(`[ModelRouter] ${result.routing.provider}/${result.routing.modelId} — ${result.routing.reason}`);
        return result.content;
    }
    async routeAndChatWithTools(taskType, messages, tools) {
        const role = this.taskToRole(taskType);
        const result = await this.router.routeAndChatWithTools(role, taskType, messages, tools);
        return result.message;
    }
    taskToRole(taskType) {
        const map = {
            chat: 'critic',
            code: 'executor',
            reasoning: 'planner',
            embedding: 'knowledge_updater',
        };
        return map[taskType];
    }
}
exports.ModelRouter = ModelRouter;
exports.default = ModelRouter;
//# sourceMappingURL=model-router.js.map