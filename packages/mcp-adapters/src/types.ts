export type MCPAdapterStatus = 'connected' | 'disconnected' | 'simulated' | 'error';

export interface MCPToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface MCPToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  toolCallId: string;
  toolName: string;
  adapterId: string;
  success: boolean;
  result: unknown;
  error?: string;
  durationMs: number;
}

export interface MCPAdapterHealth {
  id: string;
  name: string;
  status: MCPAdapterStatus;
  endpoint?: string;
  lastChecked: string;
  tools: string[];
  error?: string;
}

export interface MCPAdapterConfig {
  id: string;
  name: string;
  baseURL?: string;
  timeout?: number;
  simulateWhenUnavailable?: boolean;
}
