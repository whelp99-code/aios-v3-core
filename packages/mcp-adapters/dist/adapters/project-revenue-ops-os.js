"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRevenueOpsAdapter = void 0;
const base_adapter_1 = require("../base-adapter");
class ProjectRevenueOpsAdapter extends base_adapter_1.BaseMCPAdapter {
    getTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'revenue_create_project',
                    description: 'Create a revenue operations project',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Project name' },
                            budget: { type: 'string', description: 'Project budget' },
                        },
                        required: ['name'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'revenue_track_metrics',
                    description: 'Track revenue metrics for a project',
                    parameters: {
                        type: 'object',
                        properties: {
                            projectId: { type: 'string', description: 'Project ID' },
                            metrics: { type: 'string', description: 'Comma-separated metric names' },
                        },
                        required: ['projectId'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'revenue_generate_report',
                    description: 'Generate a revenue operations report',
                    parameters: {
                        type: 'object',
                        properties: {
                            projectId: { type: 'string', description: 'Project ID' },
                            period: { type: 'string', description: 'Report period (weekly, monthly, quarterly)' },
                        },
                        required: ['projectId'],
                    },
                },
            },
        ];
    }
    async executeTool(call) {
        const response = await this.client.post('/mcp/execute', {
            toolName: call.name,
            input: call.arguments,
        });
        return response.data;
    }
    simulateTool(call) {
        switch (call.name) {
            case 'revenue_create_project':
                return {
                    projectId: `rev-${Date.now()}`,
                    name: call.arguments.name,
                    budget: call.arguments.budget ?? '0',
                    status: 'active',
                    mode: 'simulated',
                };
            case 'revenue_track_metrics':
                return {
                    projectId: call.arguments.projectId,
                    metrics: {
                        revenue: 125000,
                        costs: 45000,
                        margin: 0.64,
                    },
                    mode: 'simulated',
                };
            case 'revenue_generate_report':
                return {
                    reportId: `report-${Date.now()}`,
                    projectId: call.arguments.projectId,
                    period: call.arguments.period ?? 'monthly',
                    summary: 'Revenue up 12% vs previous period',
                    mode: 'simulated',
                };
            default:
                return { error: `Unknown tool: ${call.name}`, mode: 'simulated' };
        }
    }
}
exports.ProjectRevenueOpsAdapter = ProjectRevenueOpsAdapter;
//# sourceMappingURL=project-revenue-ops-os.js.map