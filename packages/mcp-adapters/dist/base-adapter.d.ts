import { AxiosInstance } from 'axios';
import { MCPAdapterConfig, MCPAdapterHealth, MCPAdapterStatus, MCPToolCall, MCPToolDefinition, MCPToolResult } from './types';
export declare abstract class BaseMCPAdapter {
    protected config: MCPAdapterConfig;
    protected client: AxiosInstance;
    protected status: MCPAdapterStatus;
    constructor(config: MCPAdapterConfig);
    abstract getTools(): MCPToolDefinition[];
    abstract executeTool(call: MCPToolCall): Promise<unknown>;
    get id(): string;
    get name(): string;
    healthCheck(): Promise<MCPAdapterHealth>;
    callTool(call: MCPToolCall): Promise<MCPToolResult>;
    protected abstract simulateTool(call: MCPToolCall): unknown;
}
//# sourceMappingURL=base-adapter.d.ts.map