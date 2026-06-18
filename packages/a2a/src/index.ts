/**
 * @aios/a2a - Google A2A Agent-to-Agent Protocol Implementation
 *
 * A2A (Agent-to-Agent) is a protocol for AI agents to communicate with each other.
 * It complements MCP (Model Context Protocol) which handles agent-to-tool communication.
 *
 * Key concepts:
 * - Agent Card: Public interface description (served at /.well-known/agent.json)
 * - Task: A unit of work sent to an agent
 * - Skill: A capability that an agent can perform
 * - Discovery: Finding agents with specific capabilities
 *
 * @example
 * ```typescript
 * import { A2AAgent, A2AServer, A2AClient, A2ADiscovery } from '@aios/a2a';
 *
 * // Create an agent
 * const agent = new A2AAgent({
 *   name: 'weather-agent',
 *   description: 'Provides weather information',
 *   skills: [{ id: 'get-weather', name: 'Get Weather', description: 'Get weather for a location' }],
 *   url: 'http://localhost:3000',
 *   version: '1.0.0',
 * });
 *
 * // Register a skill handler
 * agent.registerHandler('get-weather', async (task) => ({
 *   taskId: task.id,
 *   status: 'completed',
 *   result: { temperature: 72, condition: 'sunny' },
 * }));
 *
 * // Start a server
 * const server = new A2AServer(agent, 3000);
 * await server.start();
 *
 * // Or discover and communicate with agents
 * const discovery = new A2ADiscovery();
 * const weatherAgent = await discovery.discover('http://localhost:3000');
 * const response = await weatherAgent.client.sendTask({
 *   message: 'What is the weather in San Francisco?',
 *   skillId: 'get-weather',
 * });
 * ```
 */

// Core classes
export { A2AAgent, createAgent } from './a2a-agent.js';
export { A2AServer, createServer } from './a2a-server.js';
export { A2AClient, createClient } from './a2a-client.js';
export { A2ADiscovery, createDiscovery } from './a2a-discovery.js';

// Types
export type {
  A2AAgentConfig,
  A2ATask,
  A2AResponse,
  A2ATaskStatus,
  A2ATaskHandler,
  A2ATaskMetadata,
  AgentCard,
  AgentSkill,
} from './types.js';

// Re-export discovery types
export type { DiscoveredAgent } from './a2a-discovery.js';
