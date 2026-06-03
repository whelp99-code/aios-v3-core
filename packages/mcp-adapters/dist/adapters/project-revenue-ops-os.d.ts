import { BaseMCPAdapter } from '../base-adapter';
import { MCPToolCall, MCPToolDefinition } from '../types';
export declare class ProjectRevenueOpsAdapter extends BaseMCPAdapter {
    getTools(): MCPToolDefinition[];
    executeTool(call: MCPToolCall): Promise<unknown>;
    protected simulateTool(call: MCPToolCall): unknown;
}
//# sourceMappingURL=project-revenue-ops-os.d.ts.map