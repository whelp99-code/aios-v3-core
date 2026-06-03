"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPRegistry = void 0;
exports.createDefaultMCPRegistry = createDefaultMCPRegistry;
const compensation_engine_1 = require("./compensation-engine");
const vibe_coding_os_1 = require("./adapters/vibe-coding-os");
const ai_automation_work_portal_1 = require("./adapters/ai-automation-work-portal");
const project_revenue_ops_os_1 = require("./adapters/project-revenue-ops-os");
class MCPRegistry {
    constructor(config = {}) {
        this.adapters = new Map();
        this.compensationEngine = new compensation_engine_1.CompensationEngine();
        this.registerAdapter(new vibe_coding_os_1.VibeCodingOSAdapter({
            id: 'vibe-coding-os',
            name: 'vibe-coding-os',
            baseURL: config.vibeCodingOSUrl ?? process.env.VIBE_CODING_OS_URL,
        }));
        this.registerAdapter(new ai_automation_work_portal_1.AutomationWorkPortalAdapter({
            id: 'ai-automation-work-portal',
            name: 'ai-automation-work-portal',
            baseURL: config.automationPortalUrl ?? process.env.AUTOMATION_PORTAL_URL,
        }));
        this.registerAdapter(new project_revenue_ops_os_1.ProjectRevenueOpsAdapter({
            id: 'project-revenue-ops-os',
            name: 'project-revenue-ops-os',
            baseURL: config.revenueOpsUrl ?? process.env.REVENUE_OPS_URL,
        }));
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.id, adapter);
    }
    getAdapter(id) {
        return this.adapters.get(id);
    }
    getAllTools() {
        const tools = [];
        for (const adapter of this.adapters.values()) {
            tools.push(...adapter.getTools());
        }
        return tools;
    }
    getToolAdapterMap() {
        const map = new Map();
        for (const adapter of this.adapters.values()) {
            for (const tool of adapter.getTools()) {
                map.set(tool.function.name, adapter.id);
            }
        }
        return map;
    }
    async healthCheckAll() {
        const results = [];
        for (const adapter of this.adapters.values()) {
            results.push(await adapter.healthCheck());
        }
        return results;
    }
    async executeToolCall(toolName, args, toolCallId) {
        const adapterMap = this.getToolAdapterMap();
        const adapterId = adapterMap.get(toolName);
        if (!adapterId) {
            return {
                toolCallId: toolCallId ?? `call-${Date.now()}`,
                toolName,
                adapterId: 'unknown',
                success: false,
                result: null,
                error: `No adapter found for tool: ${toolName}`,
                durationMs: 0,
            };
        }
        const adapter = this.adapters.get(adapterId);
        const call = {
            id: toolCallId ?? `call-${Date.now()}`,
            name: toolName,
            arguments: args,
        };
        let result = await adapter.callTool(call);
        if (!result.success) {
            const compensations = this.compensationEngine.planCompensation(toolName, result.error ?? 'Unknown error');
            for (const action of compensations) {
                const compResult = await this.compensationEngine.execute(action);
                if (action.type === 'retry' && compResult.success) {
                    result = await adapter.callTool(call);
                    if (result.success)
                        break;
                }
                if (action.type === 'fallback' && compResult.success) {
                    result = await adapter.callTool(call);
                    break;
                }
            }
        }
        else {
            this.compensationEngine.resetRetries(toolName);
        }
        return result;
    }
    parseToolCallsFromLLM(message) {
        if (!message.tool_calls?.length)
            return [];
        return message.tool_calls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
        }));
    }
}
exports.MCPRegistry = MCPRegistry;
function createDefaultMCPRegistry() {
    return new MCPRegistry();
}
//# sourceMappingURL=mcp-registry.js.map