/**
 * @aios/evolution
 * OpenSpace-based skill self-evolution engine for AIOS
 *
 * PR-05: Skill self-evolution with three modes:
 * - FIX: Auto-fix failed skills
 * - DERIVE: Create new skills from existing ones
 * - CAPTURE: Extract skills from successful runs
 */

export { SkillStore } from './skill-store.js';
export { EvolutionEngine, DefaultLLMClient } from './evolution-engine.js';
export { SkillCapturer, LLMPatternExtractor } from './skill-capturer.js';

export type {
  Skill,
  EvolutionMode,
  EvolutionResult,
  ExecutionRecord,
  EvolutionConfig,
} from './types.js';

export type {
  CapturedPattern,
  PatternExtractor,
} from './skill-capturer.js';
