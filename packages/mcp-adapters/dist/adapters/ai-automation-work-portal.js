"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationWorkPortalAdapter = void 0;
const base_adapter_1 = require("../base-adapter");
class AutomationWorkPortalAdapter extends base_adapter_1.BaseMCPAdapter {
    getTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'automation_create_workflow',
                    description: 'Create an automation workflow in ai-automation-work-portal',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Workflow name' },
                            trigger: { type: 'string', description: 'Trigger type (schedule, webhook, event)' },
                        },
                        required: ['name', 'trigger'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'automation_run_task',
                    description: 'Run an automation task',
                    parameters: {
                        type: 'object',
                        properties: {
                            taskId: { type: 'string', description: 'Task ID to run' },
                            params: { type: 'string', description: 'JSON-encoded task parameters' },
                        },
                        required: ['taskId'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'automation_get_status',
                    description: 'Get status of an automation workflow',
                    parameters: {
                        type: 'object',
                        properties: {
                            workflowId: { type: 'string', description: 'Workflow ID' },
                        },
                        required: ['workflowId'],
                    },
                },
            },
        ];
    }
    async executeTool(call) {
        const response = await this.client.post('/api/mcp/call', {
            tool: call.name,
            args: call.arguments,
        });
        return response.data;
    }
    simulateTool(call) {
        switch (call.name) {
            case 'automation_create_workflow':
                return {
                    workflowId: `wf-${Date.now()}`,
                    name: call.arguments.name,
                    trigger: call.arguments.trigger,
                    status: 'active',
                    mode: 'simulated',
                };
            case 'automation_run_task':
                return {
                    taskId: call.arguments.taskId,
                    status: 'completed',
                    result: 'Task executed in simulation mode',
                    mode: 'simulated',
                };
            case 'automation_get_status':
                return {
                    workflowId: call.arguments.workflowId,
                    status: 'running',
                    lastRun: new Date().toISOString(),
                    mode: 'simulated',
                };
            default:
                return { error: `Unknown tool: ${call.name}`, mode: 'simulated' };
        }
    }
}
exports.AutomationWorkPortalAdapter = AutomationWorkPortalAdapter;
//# sourceMappingURL=ai-automation-work-portal.js.map