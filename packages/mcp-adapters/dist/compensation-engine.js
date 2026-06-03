"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationEngine = void 0;
class CompensationEngine {
    constructor() {
        this.retryCounts = new Map();
    }
    planCompensation(failedTool, error, existingActions = []) {
        const actions = [];
        const retryCount = this.retryCounts.get(failedTool) ?? 0;
        if (retryCount < 3) {
            actions.push({
                type: 'retry',
                target: failedTool,
                description: `Retry ${failedTool} after failure: ${error}`,
                maxRetries: 3,
            });
        }
        actions.push({
            type: 'fallback',
            target: failedTool,
            description: `Use simulated response for ${failedTool}`,
        });
        if (!existingActions.includes('notify_admin')) {
            actions.push({
                type: 'notify',
                target: 'monitoring',
                description: `Tool ${failedTool} failed: ${error}`,
            });
        }
        return actions;
    }
    async execute(action) {
        switch (action.type) {
            case 'retry': {
                const count = (this.retryCounts.get(action.target) ?? 0) + 1;
                this.retryCounts.set(action.target, count);
                return {
                    action,
                    success: count <= (action.maxRetries ?? 3),
                    message: `Retry attempt ${count} for ${action.target}`,
                };
            }
            case 'fallback':
                return {
                    action,
                    success: true,
                    message: `Fallback activated for ${action.target}`,
                };
            case 'notify':
                console.warn(`[Compensation] ${action.description}`);
                return {
                    action,
                    success: true,
                    message: action.description,
                };
            case 'rollback':
                return {
                    action,
                    success: true,
                    message: `Rollback completed for ${action.target}`,
                };
            default:
                return {
                    action,
                    success: false,
                    message: `Unknown compensation type`,
                };
        }
    }
    resetRetries(toolName) {
        this.retryCounts.delete(toolName);
    }
}
exports.CompensationEngine = CompensationEngine;
//# sourceMappingURL=compensation-engine.js.map