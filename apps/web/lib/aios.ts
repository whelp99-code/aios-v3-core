import path from 'path';
import { RapidMLXClient, ModelRouter } from '@aios/ai-core';
import { MCPRegistry } from '@aios/mcp-adapters';
import { Orchestrator, SkillParser } from '@aios/orchestrator';

let orchestratorInstance: InstanceType<typeof Orchestrator> | null = null;
let mcpRegistryInstance: InstanceType<typeof MCPRegistry> | null = null;

export function getMCPRegistry(): InstanceType<typeof MCPRegistry> {
  if (!mcpRegistryInstance) {
    mcpRegistryInstance = new MCPRegistry({
      vibeCodingOSUrl: process.env.VIBE_CODING_OS_URL,
      automationPortalUrl: process.env.AUTOMATION_PORTAL_URL,
      revenueOpsUrl: process.env.REVENUE_OPS_URL,
    });
  }
  return mcpRegistryInstance;
}

export function getOrchestrator(): InstanceType<typeof Orchestrator> {
  if (!orchestratorInstance) {
    const client = new RapidMLXClient({
      baseURL: process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1',
      timeout: parseInt(process.env.RAPID_MLX_TIMEOUT || '60000', 10),
    });
    const router = new ModelRouter(client);
    const parser = new SkillParser();
    const skillsDir = path.resolve(process.cwd(), '../../skills');

    orchestratorInstance = new Orchestrator(client, router, parser, {
      maxIterations: 10,
      skillsDirectory: skillsDir,
      mcpRegistry: getMCPRegistry(),
    });
  }
  return orchestratorInstance;
}
