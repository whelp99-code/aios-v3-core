/**
 * @aios/evolution - Types
 * PR-05: OpenSpace-based skill self-evolution
 */

/** A skill is a reusable unit of knowledge that can evolve over time */
export interface Skill {
  id: string;
  name: string;
  content: string;
  version: number;
  parentId: string | null;
  reward: number;
  usageCount: number;
  successRate: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Evolution mode determines how a skill is created or modified */
export type EvolutionMode = 'FIX' | 'DERIVED' | 'CAPTURED';

/** Result of an evolution operation */
export interface EvolutionResult {
  /** The newly created or updated skill */
  skill: Skill;
  /** The evolution mode used */
  mode: EvolutionMode;
  /** Description of what changed */
  description: string;
  /** The parent skill ID (if derived from an existing skill) */
  parentSkillId: string | null;
  /** Timestamp of the evolution */
  timestamp: string;
}

/** Input for capturing a skill from execution */
export interface ExecutionRecord {
  /** The task that was executed */
  task: string;
  /** The skill that was used */
  skillId: string;
  /** The output produced */
  output: string;
  /** Whether the execution succeeded */
  success: boolean;
  /** Reward signal (0.0 - 1.0) */
  reward: number;
  /** Any error messages */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Configuration for the evolution engine */
export interface EvolutionConfig {
  /** LLM endpoint for generating improved skills */
  llmEndpoint?: string;
  /** LLM model name */
  llmModel?: string;
  /** API key for LLM access */
  llmApiKey?: string;
  /** Minimum reward threshold for skill promotion */
  rewardThreshold?: number;
  /** Maximum number of skill versions to keep */
  maxVersions?: number;
}
