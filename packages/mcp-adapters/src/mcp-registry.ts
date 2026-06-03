import { CompensationEngine } from './compensation-engine';
import { BaseMCPAdapter } from './base-adapter';
import { VibeCodingOSAdapter } from './adapters/vibe-coding-os';
import { AutomationWorkPortalAdapter } from './adapters/ai-automation-work-portal';
import { ProjectRevenueOpsAdapter } from './adapters/project-revenue-ops-os';
import {
  MCPAdapterHealth,
  MCPToolCall,
  MCPToolDefinition,
  MCPToolResult,
} from './types';

export interface MCPRegistryConfig {
  vibeCodingOSUrl?: string;
  automationPortalUrl?: string;
  revenueOpsUrl?: string;
}

export class MCPRegistry {
  private adapters = new Map<string, BaseMCPAdapter>();
  private compensationEngine = new CompensationEngine();

  constructor(config: MCPRegistryConfig = {}) {
    this.registerAdapter(
      new VibeCodingOSAdapter({
        id: 'vibe-coding-os',
        name: 'vibe-coding-os',
        baseURL: config.vibeCodingOSUrl ?? process.env.VIBE_CODING_OS_URL,
      })
    );
    this.registerAdapter(
      new AutomationWorkPortalAdapter({
        id: 'ai-automation-work-portal',
        name: 'ai-automation-work-portal',
        baseURL: config.automationPortalUrl ?? process.env.AUTOMATION_PORTAL_URL,
      })
    );
    this.registerAdapter(
      new ProjectRevenueOpsAdapter({
        id: 'project-revenue-ops-os',
        name: 'project-revenue-ops-os',
        baseURL: config.revenueOpsUrl ?? process.env.REVENUE_OPS_URL,
      })
    );
  }

  registerAdapter(adapter: BaseMCPAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id: string): BaseMCPAdapter | undefined {
    return this.adapters.get(id);
  }

  getAllTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = [];
    for (const adapter of this.adapters.values()) {
      tools.push(...adapter.getTools());
    }
    return tools;
  }

  getToolAdapterMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const adapter of this.adapters.values()) {
      for (const tool of adapter.getTools()) {
        map.set(tool.function.name, adapter.id);
      }
    }
    return map;
  }

  async healthCheckAll(): Promise<MCPAdapterHealth[]> {
    const results: MCPAdapterHealth[] = [];
    for (const adapter of this.adapters.values()) {
      results.push(await adapter.healthCheck());
    }
    return results;
  }

  async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    toolCallId?: string
  ): Promise<MCPToolResult> {
    const adapterMap = this.getToolAdapterMap();
    const adapterId = adapterMap.get(toolName);

    if (!adapterId) {
      return {
        toolCallId: toolCallId ?? `call-${Date.now()}`,
        toolName,
        adapterId: 'unknown',
        success: false,
        result: null,
        error: `No adapter found for tool: ${toolName}`,
        durationMs: 0,
      };
    }

    const adapter = this.adapters.get(adapterId)!;
    const call: MCPToolCall = {
      id: toolCallId ?? `call-${Date.now()}`,
      name: toolName,
      arguments: args,
    };

    let result = await adapter.callTool(call);

    if (!result.success) {
      const compensations = this.compensationEngine.planCompensation(
        toolName,
        result.error ?? 'Unknown error'
      );

      for (const action of compensations) {
        const compResult = await this.compensationEngine.execute(action);
        if (action.type === 'retry' && compResult.success) {
          result = await adapter.callTool(call);
          if (result.success) break;
        }
        if (action.type === 'fallback' && compResult.success) {
          result = await adapter.callTool(call);
          break;
        }
      }
    } else {
      this.compensationEngine.resetRetries(toolName);
    }

    return result;
  }

  parseToolCallsFromLLM(message: {
    content?: string;
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
  }): MCPToolCall[] {
    if (!message.tool_calls?.length) return [];

    return message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));
  }
}

export function createDefaultMCPRegistry(): MCPRegistry {
  return new MCPRegistry();
}
