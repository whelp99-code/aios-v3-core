# @aios/a2a

Google A2A (Agent-to-Agent) protocol implementation for AIOS.

## Overview

**A2A** (Agent-to-Agent) enables AI agents to discover and communicate with each other, complementing **MCP** (Model Context Protocol) which handles agent-to-tool communication.

### A2A vs MCP

| Feature | A2A (Agent-to-Agent) | MCP (Model Context-Tool) |
|---------|----------------------|--------------------------|
| Purpose | Agent-to-agent communication | Agent-to-tool communication |
| Discovery | Agent cards at `/.well-known/agent.json` | Tool schemas |
| Execution | Tasks with async responses | Direct tool calls |
| Use Case | Multi-agent orchestration | Single agent tool use |

## Installation

```bash
npm install @aios/a2a
```

## Quick Start

### Creating an Agent

```typescript
import { A2AAgent, A2AServer } from '@aios/a2a';

// Create an agent
const agent = new A2AAgent({
  name: 'weather-agent',
  description: 'Provides weather information',
  skills: [
    {
      id: 'get-weather',
      name: 'Get Weather',
      description: 'Get current weather for a location',
    },
  ],
  url: 'http://localhost:3000',
  version: '1.0.0',
});

// Register skill handlers
agent.registerHandler('get-weather', async (task) => {
  const { location } = task.input || {};
  return {
    taskId: task.id,
    status: 'completed',
    result: {
      location,
      temperature: 72,
      condition: 'sunny',
    },
  };
});

// Start the server
const server = new A2AServer(agent, 3000);
await server.start();
```

### Using the Client

```typescript
import { A2AClient } from '@aios/a2a';

const client = new A2AClient('http://localhost:3000');

// Discover agent capabilities
const card = await client.getAgentCard();
console.log('Available skills:', card.skills);

// Send a task
const response = await client.sendTask({
  message: 'What is the weather in San Francisco?',
  skillId: 'get-weather',
  input: { location: 'San Francisco' },
});

console.log('Response:', response.result);
```

### Agent Discovery

```typescript
import { A2ADiscovery } from '@aios/a2a';

const discovery = new A2ADiscovery();

// Discover an agent
const agent = await discovery.discover('http://localhost:3000');

// Find agents by skill
const weatherAgents = discovery.findBySkill('get-weather');

// Get all discovered agents
const allAgents = discovery.getAllAgents();
```

## API Reference

### A2AAgent

Core agent implementation that receives and processes tasks.

```typescript
class A2AAgent {
  constructor(config: A2AAgentConfig);
  registerHandler(skillId: string, handler: A2ATaskHandler): void;
  handleTask(task: A2ATask): Promise<A2AResponse>;
  getTaskStatus(taskId: string): A2AResponse | null;
  getAgentCard(): AgentCard;
  getConfig(): A2AAgentConfig;
  getRegisteredSkills(): string[];
  hasSkill(skillId: string): boolean;
}
```

### A2AServer

HTTP server implementing the A2A protocol endpoints.

```typescript
class A2AServer {
  constructor(agent: A2AAgent, port?: number);
  start(): Promise<void>;
  stop(): Promise<void>;
  getApp(): Express.Application;
}
```

**Endpoints:**
- `GET /.well-known/agent.json` - Agent discovery
- `POST /tasks/send` - Submit a task
- `GET /tasks/:id` - Get task status
- `GET /health` - Health check

### A2AClient

Client for communicating with remote A2A agents.

```typescript
class A2AClient {
  constructor(baseUrl: string, options?: { timeout?: number });
  getAgentCard(): Promise<AgentCard>;
  sendTask(task: Omit<A2ATask, 'id'>): Promise<A2AResponse>;
  getTaskStatus(taskId: string): Promise<A2AResponse>;
  healthCheck(): Promise<HealthStatus>;
  hasSkill(skillId: string): Promise<boolean>;
  sendAndWaitForCompletion(task: Omit<A2ATask, 'id'>): Promise<A2AResponse>;
}
```

### A2ADiscovery

Agent discovery and registry.

```typescript
class A2ADiscovery {
  discover(agentUrl: string): Promise<DiscoveredAgent>;
  register(card: AgentCard): DiscoveredAgent;
  findBySkill(skillId: string): DiscoveredAgent[];
  findBySkillName(name: string): DiscoveredAgent[];
  findByName(name: string): DiscoveredAgent[];
  getAllAgents(): DiscoveredAgent[];
  getAgent(url: string): DiscoveredAgent | undefined;
  getAllSkills(): AgentSkill[];
  refreshAll(): Promise<{ refreshed: number; failed: string[] }>;
  clear(): void;
}
```

## Types

### A2AAgentConfig

```typescript
interface A2AAgentConfig {
  name: string;
  description: string;
  skills: AgentSkill[];
  url: string;
  version: string;
  provider?: { organization: string; url?: string };
  capabilities?: { streaming?: boolean; pushNotifications?: boolean };
}
```

### A2ATask

```typescript
interface A2ATask {
  id: string;
  message: string;
  skillId?: string;
  input?: Record<string, unknown>;
  metadata?: A2ATaskMetadata;
}
```

### A2AResponse

```typescript
interface A2AResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
}
```

## License

MIT
