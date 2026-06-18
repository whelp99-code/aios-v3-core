/**
 * @aios/a2a - Google A2A Agent-to-Agent Protocol Types
 *
 * A2A defines how AI agents communicate with each other,
 * complementing MCP (Model Context Protocol) which handles agent-to-tool communication.
 */

/** Skills that an agent can perform */
export interface AgentSkill {
  /** Unique skill identifier */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Description of what this skill does */
  description: string;
  /** Input schemas for the skill (JSON Schema format) */
  inputSchema?: Record<string, unknown>;
  /** Output schemas for the skill (JSON Schema format) */
  outputSchema?: Record<string, unknown>;
}

/** Configuration for creating an A2A agent */
export interface A2AAgentConfig {
  /** Unique agent name/identifier */
  name: string;
  /** Human-readable description of the agent */
  description: string;
  /** Skills this agent can perform */
  skills: AgentSkill[];
  /** URL where this agent can be reached */
  url: string;
  /** Agent version */
  version: string;
  /** Optional provider information */
  provider?: {
    organization: string;
    url?: string;
  };
  /** Optional capabilities */
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
}

/** Agent card - the public interface of an agent (served at /.well-known/agent.json) */
export interface AgentCard {
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** URL of the agent */
  url: string;
  /** Agent version */
  version: string;
  /** Available skills */
  skills: AgentSkill[];
  /** Provider info */
  provider?: {
    organization: string;
    url?: string;
  };
  /** Agent capabilities */
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  /** Supported authentication schemes */
  authentication?: {
    schemes: string[];
  };
}

/** Metadata for a task */
export interface A2ATaskMetadata {
  /** Timestamp when the task was created */
  createdAt?: string;
  /** Deadline for the task */
  deadline?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Additional metadata */
  [key: string]: unknown;
}

/** A task to be executed by an agent */
export interface A2ATask {
  /** Unique task identifier */
  id: string;
  /** The message/instruction for the task */
  message: string;
  /** Optional metadata */
  metadata?: A2ATaskMetadata;
  /** Skill ID to invoke */
  skillId?: string;
  /** Input data for the skill */
  input?: Record<string, unknown>;
}

/** Task status */
export type A2ATaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Response from an agent after task execution */
export interface A2AResponse {
  /** Task identifier this response is for */
  taskId: string;
  /** Current status of the task */
  status: A2ATaskStatus;
  /** Result data (when status is 'completed') */
  result?: unknown;
  /** Error information (when status is 'failed') */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Optional streaming artifact */
  artifact?: {
    type: string;
    data: unknown;
  };
}

/** Handler function for processing tasks */
export type A2ATaskHandler = (
  task: A2ATask
) => Promise<A2AResponse>;

/** Internal task tracking */
export interface InternalTask {
  task: A2ATask;
  status: A2ATaskStatus;
  result?: unknown;
  error?: A2AResponse['error'];
  createdAt: string;
  updatedAt: string;
}
