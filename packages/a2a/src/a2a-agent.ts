import {
  A2AAgentConfig,
  A2ATask,
  A2AResponse,
  A2ATaskHandler,
  AgentCard,
  AgentSkill,
  InternalTask,
} from './types.js';
import { randomUUID } from 'node:crypto';

/**
 * A2AAgent - Core agent implementation for Agent-to-Agent communication
 *
 * This class represents an agent that can receive and process tasks
 * from other agents via the A2A protocol.
 */
export class A2AAgent {
  private config: A2AAgentConfig;
  private handlers: Map<string, A2ATaskHandler> = new Map();
  private tasks: Map<string, InternalTask> = new Map();

  constructor(config: A2AAgentConfig) {
    this.config = {
      ...config,
      version: config.version || '0.1.0',
    };
  }

  /**
   * Register a handler for a specific skill
   */
  registerHandler(skillId: string, handler: A2ATaskHandler): void {
    this.handlers.set(skillId, handler);
  }

  /**
   * Handle an incoming task - dispatches to the appropriate skill handler
   */
  async handleTask(task: A2ATask): Promise<A2AResponse> {
    const internalTask: InternalTask = {
      task,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, internalTask);

    try {
      // Determine which handler to use
      const skillId = task.skillId || this.inferSkillFromMessage(task.message);

      if (!skillId) {
        internalTask.status = 'failed';
        internalTask.error = {
          code: 'NO_SKILL_DETECTED',
          message: 'Could not determine which skill to use for this task',
        };
        internalTask.updatedAt = new Date().toISOString();
        return this.buildResponse(internalTask);
      }

      const handler = this.handlers.get(skillId);
      if (!handler) {
        internalTask.status = 'failed';
        internalTask.error = {
          code: 'SKILL_NOT_FOUND',
          message: `No handler registered for skill: ${skillId}`,
        };
        internalTask.updatedAt = new Date().toISOString();
        return this.buildResponse(internalTask);
      }

      // Update status and execute
      internalTask.status = 'running';
      internalTask.updatedAt = new Date().toISOString();

      const response = await handler(task);

      // Update internal state
      internalTask.status = response.status;
      internalTask.result = response.result;
      internalTask.error = response.error;
      internalTask.updatedAt = new Date().toISOString();

      return response;
    } catch (error) {
      internalTask.status = 'failed';
      internalTask.error = {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
      };
      internalTask.updatedAt = new Date().toISOString();
      return this.buildResponse(internalTask);
    }
  }

  /**
   * Get the status of a task
   */
  getTaskStatus(taskId: string): A2AResponse | null {
    const internalTask = this.tasks.get(taskId);
    if (!internalTask) return null;
    return this.buildResponse(internalTask);
  }

  /**
   * Get the agent card (public interface description)
   */
  getAgentCard(): AgentCard {
    return {
      name: this.config.name,
      description: this.config.description,
      url: this.config.url,
      version: this.config.version,
      skills: this.config.skills,
      provider: this.config.provider,
      capabilities: this.config.capabilities,
    };
  }

  /**
   * Get the agent configuration
   */
  getConfig(): A2AAgentConfig {
    return { ...this.config };
  }

  /**
   * Get all registered skill IDs
   */
  getRegisteredSkills(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a skill is registered
   */
  hasSkill(skillId: string): boolean {
    return this.handlers.has(skillId);
  }

  /**
   * Try to infer which skill should handle this message
   */
  private inferSkillFromMessage(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    // Simple keyword matching - could be enhanced with NLP
    for (const skill of this.config.skills) {
      const skillWords = skill.name.toLowerCase().split(/\s+/);
      const matches = skillWords.filter((word) => lowerMessage.includes(word));
      if (matches.length > 0) {
        return skill.id;
      }
    }

    // If only one skill, use it as default
    if (this.config.skills.length === 1) {
      return this.config.skills[0].id;
    }

    return null;
  }

  /**
   * Build a response from internal task state
   */
  private buildResponse(internalTask: InternalTask): A2AResponse {
    return {
      taskId: internalTask.task.id,
      status: internalTask.status,
      result: internalTask.result,
      error: internalTask.error,
    };
  }
}

/**
 * Create a new A2A agent with a generated ID
 */
export function createAgent(config: Omit<A2AAgentConfig, 'url'> & { url?: string }): A2AAgent {
  return new A2AAgent({
    ...config,
    url: config.url || `http://localhost:3000`,
    version: config.version || '0.1.0',
  });
}
