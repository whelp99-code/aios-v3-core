import { BaseMCPAdapter } from '../base-adapter';
import { MCPToolCall, MCPToolDefinition } from '../types';
export declare class VibeCodingOSAdapter extends BaseMCPAdapter {
    getTools(): MCPToolDefinition[];
    executeTool(call: MCPToolCall): Promise<unknown>;
    protected simulateTool(call: MCPToolCall): unknown;
}
//# sourceMappingURL=vibe-coding-os.d.ts.map