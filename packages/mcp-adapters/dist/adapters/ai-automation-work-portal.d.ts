import { BaseMCPAdapter } from '../base-adapter';
import { MCPToolCall, MCPToolDefinition } from '../types';
export declare class AutomationWorkPortalAdapter extends BaseMCPAdapter {
    getTools(): MCPToolDefinition[];
    executeTool(call: MCPToolCall): Promise<unknown>;
    protected simulateTool(call: MCPToolCall): unknown;
}
//# sourceMappingURL=ai-automation-work-portal.d.ts.map