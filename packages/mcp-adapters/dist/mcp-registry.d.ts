import { BaseMCPAdapter } from './base-adapter';
import { MCPAdapterHealth, MCPToolCall, MCPToolDefinition, MCPToolResult } from './types';
export interface MCPRegistryConfig {
    vibeCodingOSUrl?: string;
    automationPortalUrl?: string;
    revenueOpsUrl?: string;
}
export declare class MCPRegistry {
    private adapters;
    private compensationEngine;
    constructor(config?: MCPRegistryConfig);
    registerAdapter(adapter: BaseMCPAdapter): void;
    getAdapter(id: string): BaseMCPAdapter | undefined;
    getAllTools(): MCPToolDefinition[];
    getToolAdapterMap(): Map<string, string>;
    healthCheckAll(): Promise<MCPAdapterHealth[]>;
    executeToolCall(toolName: string, args: Record<string, unknown>, toolCallId?: string): Promise<MCPToolResult>;
    parseToolCallsFromLLM(message: {
        content?: string;
        tool_calls?: Array<{
            id: string;
            function: {
                name: string;
                arguments: string;
            };
        }>;
    }): MCPToolCall[];
}
export declare function createDefaultMCPRegistry(): MCPRegistry;
//# sourceMappingURL=mcp-registry.d.ts.map