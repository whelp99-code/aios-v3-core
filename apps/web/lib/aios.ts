import path from 'path';
import { AIOS } from '@aios/core';

let aiosInstance: AIOS | null = null;

export function getAIOS(): AIOS {
  if (!aiosInstance) {
    aiosInstance = new AIOS({
      rapidMLXBaseURL: process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1',
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      dataDir: path.resolve(process.cwd(), '../../data'),
      skillsDirectory: path.resolve(process.cwd(), '../../skills'),
      engineMode: (process.env.AIOS_ENGINE_MODE as 'auto' | 'local' | 'cloud') || 'auto',
      mcp: {
        vibeCodingOSUrl: process.env.VIBE_CODING_OS_URL,
        automationPortalUrl: process.env.AUTOMATION_PORTAL_URL,
        revenueOpsUrl: process.env.REVENUE_OPS_URL,
      },
    });
  }
  return aiosInstance;
}

export function resetAIOS(): void {
  aiosInstance = null;
}

export function getOrchestrator() {
  return getAIOS().getOrchestrator();
}

export function getMCPRegistry() {
  return getAIOS().mcp;
}
