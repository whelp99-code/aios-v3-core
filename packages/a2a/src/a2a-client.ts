import axios, { AxiosInstance } from 'axios';
import { A2ATask, A2AResponse, AgentCard } from './types.js';

/**
 * A2AClient - Client for communicating with A2A agents
 *
 * Provides methods to interact with remote agents following the A2A protocol:
 * - Discover agent capabilities via agent card
 * - Send tasks for execution
 * - Check task status
 * - Health checking
 */
export class A2AClient {
  private baseUrl: string;
  private httpClient: AxiosInstance;
  private timeout: number;

  constructor(baseUrl: string, options: { timeout?: number } = {}) {
    // Normalize URL - remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = options.timeout || 30000;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get the agent card from the remote agent
   * Endpoint: GET /.well-known/agent.json
   */
  async getAgentCard(): Promise<AgentCard> {
    const response = await this.httpClient.get<AgentCard>('/.well-known/agent.json');
    return response.data;
  }

  /**
   * Send a task to the remote agent
   * Endpoint: POST /tasks/send
   */
  async sendTask(task: Omit<A2ATask, 'id'> & { id?: string }): Promise<A2AResponse> {
    const response = await this.httpClient.post<A2AResponse>('/tasks/send', task);
    return response.data;
  }

  /**
   * Get the status of a task
   * Endpoint: GET /tasks/:id
   */
  async getTaskStatus(taskId: string): Promise<A2AResponse> {
    const response = await this.httpClient.get<A2AResponse>(`/tasks/${taskId}`);
    return response.data;
  }

  /**
   * Check if the remote agent is healthy
   * Endpoint: GET /health
   */
  async healthCheck(): Promise<{
    status: string;
    agent: string;
    version: string;
    skills: string[];
    uptime: number;
    timestamp: string;
  }> {
    const response = await this.httpClient.get('/health');
    return response.data;
  }

  /**
   * Check if the agent supports a specific skill
   */
  async hasSkill(skillId: string): Promise<boolean> {
    try {
      const card = await this.getAgentCard();
      return card.skills.some((skill) => skill.id === skillId);
    } catch {
      return false;
    }
  }

  /**
   * Get all available skill IDs from the remote agent
   */
  async getAvailableSkills(): Promise<string[]> {
    try {
      const card = await this.getAgentCard();
      return card.skills.map((skill) => skill.id);
    } catch {
      return [];
    }
  }

  /**
   * Send a task and wait for completion (polls for status)
   */
  async sendAndWaitForCompletion(
    task: Omit<A2ATask, 'id'> & { id?: string },
    options: { pollInterval?: number; maxAttempts?: number } = {}
  ): Promise<A2AResponse> {
    const { pollInterval = 1000, maxAttempts = 30 } = options;

    const initialResponse = await this.sendTask(task);

    // If already completed, return immediately
    if (initialResponse.status === 'completed' || initialResponse.status === 'failed') {
      return initialResponse;
    }

    // Poll for completion
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const statusResponse = await this.getTaskStatus(initialResponse.taskId);

      if (statusResponse.status === 'completed' || statusResponse.status === 'failed') {
        return statusResponse;
      }

      attempts++;
    }

    return {
      ...initialResponse,
      status: 'failed',
      error: {
        code: 'TIMEOUT',
        message: `Task did not complete within ${maxAttempts * pollInterval}ms`,
      },
    };
  }

  /**
   * Update the base URL (e.g., for failover)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    this.httpClient.defaults.baseURL = this.baseUrl;
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Create a client for the given agent URL
 */
export function createClient(agentUrl: string, options?: { timeout?: number }): A2AClient {
  return new A2AClient(agentUrl, options);
}
