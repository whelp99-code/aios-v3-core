import path from 'path';
import { AIOS } from '@aios/core';

let aiosInstance: AIOS | null = null;

export function getAIOS(): AIOS {
  if (!aiosInstance) {
    aiosInstance = new AIOS({
      rapidMLXBaseURL: process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1',
      dataDir: path.resolve(process.cwd(), '../../data'),
      skillsDirectory: path.resolve(process.cwd(), '../../skills'),
      mcp: {
        vibeCodingOSUrl: process.env.VIBE_CODING_OS_URL,
        automationPortalUrl: process.env.AUTOMATION_PORTAL_URL,
        revenueOpsUrl: process.env.REVENUE_OPS_URL,
      },
    });
  }
  return aiosInstance;
}

export function getOrchestrator() {
  return getAIOS().getOrchestrator();
}

export function getMCPRegistry() {
  return getAIOS().mcp;
}
