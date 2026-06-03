"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibeCodingOSAdapter = void 0;
const base_adapter_1 = require("../base-adapter");
class VibeCodingOSAdapter extends base_adapter_1.BaseMCPAdapter {
    getTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'vibe_create_project',
                    description: 'Create a new coding project in vibe-coding-os',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Project name' },
                            template: { type: 'string', description: 'Project template (nextjs, express, etc.)' },
                        },
                        required: ['name'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'vibe_run_code',
                    description: 'Execute code in the vibe-coding-os sandbox',
                    parameters: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', description: 'Code to execute' },
                            language: { type: 'string', description: 'Programming language' },
                        },
                        required: ['code'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'vibe_deploy',
                    description: 'Deploy project from vibe-coding-os',
                    parameters: {
                        type: 'object',
                        properties: {
                            projectId: { type: 'string', description: 'Project ID to deploy' },
                            environment: { type: 'string', description: 'Target environment (staging/production)' },
                        },
                        required: ['projectId'],
                    },
                },
            },
        ];
    }
    async executeTool(call) {
        const response = await this.client.post('/mcp/tools/call', {
            name: call.name,
            arguments: call.arguments,
        });
        return response.data;
    }
    simulateTool(call) {
        switch (call.name) {
            case 'vibe_create_project':
                return {
                    projectId: `vibe-${Date.now()}`,
                    name: call.arguments.name,
                    template: call.arguments.template ?? 'nextjs',
                    status: 'created',
                    mode: 'simulated',
                };
            case 'vibe_run_code':
                return {
                    output: `[simulated] Code executed successfully`,
                    language: call.arguments.language ?? 'typescript',
                    exitCode: 0,
                    mode: 'simulated',
                };
            case 'vibe_deploy':
                return {
                    deploymentId: `deploy-${Date.now()}`,
                    projectId: call.arguments.projectId,
                    environment: call.arguments.environment ?? 'staging',
                    url: `https://simulated.vibe-coding-os.dev/${call.arguments.projectId}`,
                    mode: 'simulated',
                };
            default:
                return { error: `Unknown tool: ${call.name}`, mode: 'simulated' };
        }
    }
}
exports.VibeCodingOSAdapter = VibeCodingOSAdapter;
//# sourceMappingURL=vibe-coding-os.js.map