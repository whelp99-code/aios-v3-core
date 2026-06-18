/**
 * @aios/hyperagents — Meta-cognitive system for reflective, self-improving agents.
 *
 * PR-09 · Hyperagents Package
 *
 * Key concept:
 *   A **Task Agent** executes work. A **Meta Agent** sits above it,
 *   reflecting on the process, diagnosing failures, and modifying the
 *   program itself to improve outcomes.
 *
 * @packageDocumentation
 */

export { MetaCognitiveAgent } from "./meta-cognitive-agent.js";
export { SafetyGuard } from "./safety-guard.js";
export { RecursiveImprover } from "./recursive-improver.js";

export type {
  Reflection,
  MetaContext,
  SafetyConfig,
  ImprovementRecord,
  ImprovementResult,
  SafetyGuardStatus,
} from "./types.js";
