import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: [
    '@aios/core',
    '@aios/ai-core',
    '@aios/self-evolution',
    'aios-orchestrator',
    'aios-mcp-adapters',
    'aios-knowledge-graph',
  ],
  serverExternalPackages: ['@langchain/langgraph'],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
