/**
 * @aios/evolution - SkillCapturer
 * Extracts reusable skills from successful execution records
 */

import type { Skill, ExecutionRecord } from './types.js';

/** A captured skill pattern from execution analysis */
export interface CapturedPattern {
  /** The extracted skill name */
  name: string;
  /** The extracted skill content/instructions */
  content: string;
  /** Confidence score for the pattern (0.0 - 1.0) */
  confidence: number;
  /** Which executions contributed to this pattern */
  sourceExecutions: string[];
  /** Extracted metadata */
  metadata: Record<string, unknown>;
}

/** LLM interface for pattern extraction */
export interface PatternExtractor {
  extractPatterns(executions: ExecutionRecord[]): Promise<CapturedPattern[]>;
}

/** Default pattern extractor using LLM */
export class LLMPatternExtractor implements PatternExtractor {
  private endpoint: string;
  private model: string;
  private apiKey: string;

  constructor(config: { endpoint: string; model: string; apiKey: string }) {
    this.endpoint = config.endpoint;
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  async extractPatterns(executions: ExecutionRecord[]): Promise<CapturedPattern[]> {
    const successfulExecutions = executions.filter((e) => e.success);

    if (successfulExecutions.length === 0) {
      return [];
    }

    const prompt = this.buildExtractionPrompt(successfulExecutions);

    try {
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
                'You are an expert at extracting reusable skill patterns from task executions. Analyze the provided executions and extract actionable, reusable skills.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const content = (data as {choices?: Array<{message?: {content?: string}}>}).choices?.[0]?.message?.content;
      const parsed = JSON.parse(content ?? '{}');

      return (parsed.patterns ?? []).map((p: Record<string, unknown>, i: number) => ({
        name: p.name ?? `captured_pattern_${i}`,
        content: p.content ?? '',
        confidence: typeof p.confidence === 'number' ? Math.min(1, Math.max(0, p.confidence)) : 0.5,
        sourceExecutions: successfulExecutions.map((e) => e.task),
        metadata: p.metadata ?? {},
      }));
    } catch (error) {
      console.error('Pattern extraction failed:', error);
      return [];
    }
  }

  private buildExtractionPrompt(executions: ExecutionRecord[]): string {
    const executionSummaries = executions
      .map(
        (e, i) =>
          `Execution ${i + 1}:
  Task: ${e.task}
  Output: ${e.output.substring(0, 500)}${e.output.length > 500 ? '...' : ''}
  Reward: ${e.reward}
  Duration: ${e.duration ? `${e.duration}ms` : 'N/A'}`
      )
      .join('\n\n');

    return `Analyze the following successful task executions and extract reusable skill patterns.

Executions:
${executionSummaries}

Return a JSON object with a "patterns" array. Each pattern should have:
- name: A descriptive name for the skill
- content: The full skill instruction/content that could be reused
- confidence: A number between 0 and 1 indicating confidence in the pattern
- metadata: Any additional useful metadata

Focus on extracting patterns that are generalizable across similar tasks.`;
  }
}

export class SkillCapturer {
  private extractor: PatternExtractor;

  constructor(extractor?: PatternExtractor) {
    this.extractor = extractor ?? (null as unknown as PatternExtractor);
  }

  /**
   * Capture skills from a list of execution records
   */
  async capture(executions: ExecutionRecord[]): Promise<CapturedPattern[]> {
    const successful = executions.filter((e) => e.success && e.reward >= 0.5);

    if (successful.length === 0) {
      return [];
    }

    if (this.extractor) {
      return this.extractor.extractPatterns(successful);
    }

    // Fallback: basic heuristic pattern extraction
    return this.heuristicCapture(successful);
  }

  /**
   * Capture a skill from a single successful execution
   */
  async captureSingle(execution: ExecutionRecord): Promise<CapturedPattern | null> {
    if (!execution.success || execution.reward < 0.5) {
      return null;
    }

    const patterns = await this.capture([execution]);
    return patterns[0] ?? null;
  }

  /**
   * Convert a CapturedPattern into a Skill object (partial, for saving to SkillStore)
   */
  toSkill(pattern: CapturedPattern): Partial<Skill> & { name: string; content: string } {
    return {
      name: pattern.name,
      content: pattern.content,
      reward: pattern.confidence,
      metadata: {
        ...pattern.metadata,
        source: 'captured',
        sourceExecutions: pattern.sourceExecutions,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Basic heuristic pattern extraction without LLM
   * Identifies common task patterns from successful executions
   */
  private async heuristicCapture(executions: ExecutionRecord[]): Promise<CapturedPattern[]> {
    const patterns: CapturedPattern[] = [];

    // Group by similar tasks (simple prefix matching)
    const groups = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const key = this.extractTaskKey(exec.task);
      const existing = groups.get(key) ?? [];
      existing.push(exec);
      groups.set(key, existing);
    }

    for (const [key, groupExecutions] of Array.from(groups.entries())) {
      if (groupExecutions.length >= 2) {
        patterns.push({
          name: `pattern_${key}`,
          content: this.synthesizeSkillContent(groupExecutions),
          confidence: this.calculateGroupConfidence(groupExecutions),
          sourceExecutions: groupExecutions.map((e) => e.task),
          metadata: {
            extractionMethod: 'heuristic',
            groupSize: groupExecutions.length,
            avgReward: groupExecutions.reduce((sum, e) => sum + e.reward, 0) / groupExecutions.length,
          },
        });
      }
    }

    return patterns;
  }

  /** Extract a key from a task description for grouping */
  private extractTaskKey(task: string): string {
    // Use first few words as a grouping key
    const words = task.toLowerCase().split(/\s+/).slice(0, 3);
    return words.join('_');
  }

  /** Synthesize skill content from a group of executions */
  private synthesizeSkillContent(executions: ExecutionRecord[]): string {
    const avgReward = executions.reduce((sum, e) => sum + e.reward, 0) / executions.length;
    const task = executions[0].task;
    const output = executions[0].output;

    return `Pattern extracted from ${executions.length} successful executions.

Task: ${task}
Avg Reward: ${avgReward.toFixed(2)}

Successful approach:
${output.substring(0, 1000)}

This pattern was consistently successful across ${executions.length} executions.`;
  }

  /** Calculate confidence score for a group of executions */
  private calculateGroupConfidence(executions: ExecutionRecord[]): number {
    const avgReward = executions.reduce((sum, e) => sum + e.reward, 0) / executions.length;
    const consistencyBonus = Math.min(0.2, executions.length * 0.05);
    return Math.min(1.0, avgReward + consistencyBonus);
  }
}
