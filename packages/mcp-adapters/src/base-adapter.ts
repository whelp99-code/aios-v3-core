import axios, { AxiosInstance } from 'axios';
import {
  MCPAdapterConfig,
  MCPAdapterHealth,
  MCPAdapterStatus,
  MCPToolCall,
  MCPToolDefinition,
  MCPToolResult,
} from './types';

export abstract class BaseMCPAdapter {
  protected config: MCPAdapterConfig;
  protected client: AxiosInstance;
  protected status: MCPAdapterStatus = 'disconnected';

  constructor(config: MCPAdapterConfig) {
    this.config = {
      timeout: 10000,
      simulateWhenUnavailable: true,
      ...config,
    };
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });
  }

  abstract getTools(): MCPToolDefinition[];
  abstract executeTool(call: MCPToolCall): Promise<unknown>;

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  async healthCheck(): Promise<MCPAdapterHealth> {
    const tools = this.getTools().map((t) => t.function.name);
    const now = new Date().toISOString();

    if (!this.config.baseURL) {
      this.status = 'simulated';
      return {
        id: this.id,
        name: this.name,
        status: 'simulated',
        lastChecked: now,
        tools,
      };
    }

    try {
      await this.client.get('/health', { timeout: 5000 });
      this.status = 'connected';
      return {
        id: this.id,
        name: this.name,
        status: 'connected',
        endpoint: this.config.baseURL,
        lastChecked: now,
        tools,
      };
    } catch {
      if (this.config.simulateWhenUnavailable) {
        this.status = 'simulated';
        return {
          id: this.id,
          name: this.name,
          status: 'simulated',
          endpoint: this.config.baseURL,
          lastChecked: now,
          tools,
          error: 'External service unavailable, using simulation mode',
        };
      }

      this.status = 'error';
      return {
        id: this.id,
        name: this.name,
        status: 'error',
        endpoint: this.config.baseURL,
        lastChecked: now,
        tools,
        error: 'Connection failed',
      };
    }
  }

  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    const start = Date.now();
    try {
      const result = await this.executeTool(call);
      return {
        toolCallId: call.id,
        toolName: call.name,
        adapterId: this.id,
        success: true,
        result,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (this.config.simulateWhenUnavailable) {
        const simulated = this.simulateTool(call);
        return {
          toolCallId: call.id,
          toolName: call.name,
          adapterId: this.id,
          success: true,
          result: simulated,
          durationMs: Date.now() - start,
        };
      }

      return {
        toolCallId: call.id,
        toolName: call.name,
        adapterId: this.id,
        success: false,
        result: null,
        error: message,
        durationMs: Date.now() - start,
      };
    }
  }

  protected abstract simulateTool(call: MCPToolCall): unknown;
}
