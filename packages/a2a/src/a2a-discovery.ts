import { A2AClient } from './a2a-client.js';
import { AgentCard, AgentSkill } from './types.js';

/**
 * Discovered agent information
 */
export interface DiscoveredAgent {
  /** The agent card */
  card: AgentCard;
  /** Client for communicating with this agent */
  client: A2AClient;
  /** When this agent was discovered */
  discoveredAt: string;
}

/**
 * A2ADiscovery - Agent discovery and registry
 *
 * Provides methods to discover, register, and find A2A agents
 * based on their capabilities and skills.
 */
export class A2ADiscovery {
  private agents: Map<string, DiscoveredAgent> = new Map();

  /**
   * Discover an agent by its URL
   * Fetches the agent card and creates a client
   */
  async discover(agentUrl: string): Promise<DiscoveredAgent> {
    const client = new A2AClient(agentUrl);
    const card = await client.getAgentCard();

    const discovered: DiscoveredAgent = {
      card,
      client,
      discoveredAt: new Date().toISOString(),
    };

    // Store by URL
    this.agents.set(agentUrl, discovered);

    return discovered;
  }

  /**
   * Register a known agent without fetching its card
   */
  register(card: AgentCard, client?: A2AClient): DiscoveredAgent {
    const discovered: DiscoveredAgent = {
      card,
      client: client || new A2AClient(card.url),
      discoveredAt: new Date().toISOString(),
    };

    this.agents.set(card.url, discovered);
    return discovered;
  }

  /**
   * Find agents that have a specific skill
   */
  findBySkill(skillId: string): DiscoveredAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.card.skills.some((skill) => skill.id === skillId)
    );
  }

  /**
   * Find agents by skill name (fuzzy match)
   */
  findBySkillName(name: string): DiscoveredAgent[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.agents.values()).filter((agent) =>
      agent.card.skills.some(
        (skill) =>
          skill.name.toLowerCase().includes(lowerName) ||
          skill.description.toLowerCase().includes(lowerName)
      )
    );
  }

  /**
   * Find agents by name (fuzzy match)
   */
  findByName(name: string): DiscoveredAgent[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.agents.values()).filter((agent) =>
      agent.card.name.toLowerCase().includes(lowerName) ||
      agent.card.description.toLowerCase().includes(lowerName)
    );
  }

  /**
   * Get all discovered agents
   */
  getAllAgents(): DiscoveredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get a specific agent by URL
   */
  getAgent(url: string): DiscoveredAgent | undefined {
    return this.agents.get(url);
  }

  /**
   * Remove an agent from the registry
   */
  removeAgent(url: string): boolean {
    return this.agents.delete(url);
  }

  /**
   * Get all unique skills across all discovered agents
   */
  getAllSkills(): AgentSkill[] {
    const skillsMap = new Map<string, AgentSkill>();

    for (const agent of Array.from(this.agents.values())) {
      for (const skill of agent.card.skills) {
        skillsMap.set(skill.id, skill);
      }
    }

    return Array.from(skillsMap.values());
  }

  /**
   * Get count of discovered agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Check if an agent is already discovered
   */
  hasAgent(url: string): boolean {
    return this.agents.has(url);
  }

  /**
   * Refresh agent cards for all discovered agents
   * Useful for detecting updates or removing stale agents
   */
  async refreshAll(): Promise<{ refreshed: number; failed: string[] }> {
    const failed: string[] = [];
    let refreshed = 0;

    for (const [url, agent] of Array.from(this.agents.entries())) {
      try {
        const card = await agent.client.getAgentCard();
        this.agents.set(url, {
          ...agent,
          card,
          discoveredAt: new Date().toISOString(),
        });
        refreshed++;
      } catch {
        failed.push(url);
      }
    }

    return { refreshed, failed };
  }

  /**
   * Clear all discovered agents
   */
  clear(): void {
    this.agents.clear();
  }
}

/**
 * Create a new discovery instance
 */
export function createDiscovery(): A2ADiscovery {
  return new A2ADiscovery();
}
