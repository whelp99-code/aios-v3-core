import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@aios/ai-core', '@aios/orchestrator', '@aios/mcp-adapters'],
  serverExternalPackages: ['@langchain/langgraph'],
};

export default nextConfig;
