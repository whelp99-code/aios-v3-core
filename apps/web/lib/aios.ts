import path from 'path';
import { AIOS } from '@aios/core';

let aiosInstance: AIOS | null = null;

export function getAIOS(): AIOS {
  if (!aiosInstance) {
    aiosInstance = new AIOS({
      rapidMLXBaseURL: process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1',
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      huggingfaceApiKey: process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY,
      mimoApiKey: process.env.MIMO_API_KEY,
      mimoBaseURL: process.env.MIMO_BASE_URL,
      dataDir: path.resolve(process.cwd(), '../../data'),
      skillsDirectory: path.resolve(process.cwd(), '../../skills'),
      engineMode: (process.env.AIOS_ENGINE_MODE as 'auto' | 'local' | 'cloud') || 'auto',
      enginePreferences: {
        preferredCloudProvider:
          (process.env.AIOS_CLOUD_PROVIDER as 'mimo' | 'openai' | 'anthropic' | 'huggingface') ??
          'mimo',
      },
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
