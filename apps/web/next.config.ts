import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@aios/core', '@aios/ai-core', '@aios/orchestrator', '@aios/mcp-adapters', '@aios/knowledge-graph', '@aios/self-evolution'],
  serverExternalPackages: ['@langchain/langgraph'],
};

export default nextConfig;
