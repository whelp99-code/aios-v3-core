/**
 * @aios/evolution - EvolutionEngine
 * Core engine for skill self-evolution with LLM-powered improvements
 */

import { v4 as uuidv4 } from 'uuid';
import type { Skill, EvolutionMode, EvolutionResult, EvolutionConfig, ExecutionRecord } from './types.js';
import type { SkillStore } from './skill-store.js';
import type { SkillCapturer } from './skill-capturer.js';

/** LLM client interface for generating improved skills */
export interface LLMClient {
  generate(prompt: string): Promise<string>;
}

/** HTTP-based LLM client */
export class DefaultLLMClient implements LLMClient {
  private endpoint: string;
  private model: string;
  private apiKey: string;

  constructor(config: EvolutionConfig) {
    this.endpoint = config.llmEndpoint ?? 'https://api.openai.com/v1';
    this.model = config.llmModel ?? 'gpt-4';
    this.apiKey = config.llmApiKey ?? process.env.OPENAI_API_KEY ?? '';
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at creating and improving AI skills. Always return valid JSON with a "content" field containing the skill instruction, and a "description" field explaining what changed.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return (data as {choices?: Array<{message?: {content?: string}}>}).choices?.[0]?.message?.content ?? '{}';
  }
}

export class EvolutionEngine {
  private store: SkillStore;
  private capturer: SkillCapturer | null;
  private llm: LLMClient;
  private config: Required<EvolutionConfig>;

  constructor(store: SkillStore, config: EvolutionConfig = {}, capturer?: SkillCapturer) {
    this.store = store;
    this.capturer = capturer ?? null;
    this.config = {
      llmEndpoint: config.llmEndpoint ?? 'https://api.openai.com/v1',
      llmModel: config.llmModel ?? 'gpt-4',
      llmApiKey: config.llmApiKey ?? process.env.OPENAI_API_KEY ?? '',
      rewardThreshold: config.rewardThreshold ?? 0.7,
      maxVersions: config.maxVersions ?? 10,
    };
    this.llm = new DefaultLLMClient(this.config);
  }

  /**
   * FIX mode: Auto-fix a failed skill based on error feedback
   */
  async fixSkill(skillId: string, errorFeedback: string): Promise<EvolutionResult> {
    const originalSkill = this.store.findById(skillId);
    if (!originalSkill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const prompt = `The following skill failed during execution. Please fix it.

## Original Skill
Name: ${originalSkill.name}
Content:
${originalSkill.content}

## Error Feedback
${errorFeedback}

## Task
Analyze the error and fix the skill so it handles this case correctly.
Return JSON with:
- "content": the fixed skill content
- "description": what was changed and why`;

    const llmResponse = await this.llm.generate(prompt);
    const parsed = this.parseLLMResponse(llmResponse);

    const fixedSkill = this.store.save({
      name: originalSkill.name,
      content: parsed.content,
      version: originalSkill.version + 1,
      parentId: originalSkill.id,
      reward: 0, // Reset reward for new version
      metadata: {
        evolutionMode: 'FIX',
        errorFeedback,
        fixedAt: new Date().toISOString(),
      },
    });

    return {
      skill: fixedSkill,
      mode: 'FIX',
      description: parsed.description,
      parentSkillId: originalSkill.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * DERIVE mode: Create a new skill derived from an existing one
   */
  async deriveSkill(
    parentSkillId: string,
    newPurpose: string
  ): Promise<EvolutionResult> {
    const parentSkill = this.store.findById(parentSkillId);
    if (!parentSkill) {
      throw new Error(`Parent skill not found: ${parentSkillId}`);
    }

    const prompt = `Based on the following existing skill, create a new specialized skill.

## Parent Skill
Name: ${parentSkill.name}
Content:
${parentSkill.content}

## New Purpose
${newPurpose}

## Task
Create a new skill that is inspired by the parent skill but specialized for the new purpose.
Return JSON with:
- "name": a descriptive name for the new skill
- "content": the full skill content
- "description": what was created and how it relates to the parent`;

    const llmResponse = await this.llm.generate(prompt);
    const parsed = this.parseLLMResponse(llmResponse);

    const derivedSkill = this.store.save({
      name: parsed.name ?? `${parentSkill.name}_derived`,
      content: parsed.content,
      version: 1,
      parentId: parentSkill.id,
      reward: 0,
      metadata: {
        evolutionMode: 'DERIVED',
        newPurpose,
        derivedAt: new Date().toISOString(),
      },
    });

    return {
      skill: derivedSkill,
      mode: 'DERIVED',
      description: parsed.description,
      parentSkillId: parentSkill.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * CAPTURE mode: Extract and save skills from successful execution records
   */
  async captureSkill(
    executions: ExecutionRecord[],
    customName?: string
  ): Promise<EvolutionResult[]> {
    if (!this.capturer) {
      throw new Error('SkillCapturer is required for CAPTURE mode');
    }

    const patterns = await this.capturer.capture(executions);
    const results: EvolutionResult[] = [];

    for (const pattern of patterns) {
      const skillPartial = this.capturer.toSkill(pattern);
      const skill = this.store.save({
        ...skillPartial,
        name: customName ?? skillPartial.name,
        version: 1,
        parentId: null,
        metadata: {
          ...skillPartial.metadata,
          evolutionMode: 'CAPTURED',
        },
      });

      results.push({
        skill,
        mode: 'CAPTURED',
        description: `Captured skill from ${pattern.sourceExecutions.length} successful executions (confidence: ${pattern.confidence.toFixed(2)})`,
        parentSkillId: null,
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Auto-evolve: automatically select the best evolution strategy
   * - If skill failed recently → FIX
   * - If high-performing skill exists → DERIVE
   * - If multiple successful executions of same task → CAPTURE
   */
  async autoEvolve(
    skillId?: string,
    executions?: ExecutionRecord[]
  ): Promise<EvolutionResult | EvolutionResult[]> {
    // CAPTURE mode: if we have execution records, try to capture patterns
    if (executions && executions.length > 0) {
      const successful = executions.filter((e) => e.success && e.reward >= this.config.rewardThreshold);
      if (successful.length >= 2 && this.capturer) {
        return this.captureSkill(executions);
      }
    }

    // FIX or DERIVE mode: if we have a skill ID
    if (skillId) {
      const skill = this.store.findById(skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      // If skill has low reward, try to fix it
      if (skill.reward < this.config.rewardThreshold && skill.successRate < 0.8) {
        return this.fixSkill(skillId, `Low reward (${skill.reward}) and low success rate (${skill.successRate})`);
      }

      // If skill is high-performing, derive a new one
      if (skill.reward >= this.config.rewardThreshold) {
        return this.deriveSkill(
          skillId,
          `Derived from high-performing skill (reward: ${skill.reward}). Create a specialized variant.`
        );
      }
    }

    throw new Error('Cannot auto-evolve: insufficient information. Provide a skillId or execution records.');
  }

  /**
   * Promote a skill based on reward signals
   */
  promoteSkill(skillId: string, reward: number): Skill | null {
    const skill = this.store.findById(skillId);
    if (!skill) return null;

    const newReward = Math.min(1.0, Math.max(0.0, (skill.reward + reward) / 2));
    return this.store.update(skillId, { reward: newReward });
  }

  /**
   * Update success rate after an execution
   */
  recordExecution(skillId: string, success: boolean): Skill | null {
    const skill = this.store.findById(skillId);
    if (!skill) return null;

    this.store.incrementUsage(skillId);
    const totalUsages = skill.usageCount + 1;
    const successes = Math.round(skill.successRate * skill.usageCount) + (success ? 1 : 0);
    const newSuccessRate = successes / totalUsages;

    return this.store.update(skillId, { successRate: newSuccessRate });
  }

  /**
   * Get evolution statistics
   */
  getStats(): {
    totalSkills: number;
    topSkills: Skill[];
    byMode: Record<EvolutionMode, number>;
  } {
    const topSkills = this.store.findTopSkills(5);

    // Count skills by evolution mode
    const byMode: Record<EvolutionMode, number> = { FIX: 0, DERIVED: 0, CAPTURED: 0 };
    for (const skill of topSkills) {
      const mode = (skill.metadata as Record<string, unknown>)?.evolutionMode as EvolutionMode;
      if (mode && mode in byMode) {
        byMode[mode]++;
      }
    }

    return {
      totalSkills: topSkills.length,
      topSkills,
      byMode,
    };
  }

  /** Parse LLM response into structured data */
  private parseLLMResponse(response: string): {
    content: string;
    name?: string;
    description: string;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content ?? '',
        name: parsed.name,
        description: parsed.description ?? 'No description provided',
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        content: response,
        description: 'LLM response could not be parsed as JSON',
      };
    }
  }
}
