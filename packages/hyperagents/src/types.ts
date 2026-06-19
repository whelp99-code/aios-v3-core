/**
 * Core type definitions for the Hyperagents meta-cognitive system.
 *
 * Key concept: A Task Agent does the work. A Meta Agent sits above it,
 * reflecting on the process, diagnosing failures, and modifying the
 * program itself to improve outcomes.
 */

// ---------------------------------------------------------------------------
// Reflection — produced by MetaCognitiveAgent.reflect()
// ---------------------------------------------------------------------------

export interface Reflection {
  /** What happened during the last execution and why it matters. */
  analysis: string;
  /** The identified root cause of any failure or sub-optimal result. */
  rootCause: string;
  /** Concrete proposal describing how to fix the issue. */
  improvementProposal: string;
  /** Validated source-code patch that, when applied, implements the proposal. */
  codePatch: string;
  /** Confidence that this reflection is accurate and the patch will help (0–1). */
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// MetaContext — input to the reflective loop
// ---------------------------------------------------------------------------

export interface MetaContext {
  /** The original task or prompt that kicked off execution. */
  taskInput: string;
  /** The result (or error) returned by the task agent. */
  executionResult: string;
  /** Rolling success rate across recent attempts (0–1). */
  successRate: number;
  /** Most recent failure messages, newest first. */
  recentFailures: string[];
  /** The current source code / configuration the agent is operating on. */
  currentCode: string;
}

// ---------------------------------------------------------------------------
// SafetyConfig — guards for the recursive improvement loop
// ---------------------------------------------------------------------------

export interface SafetyConfig {
  /** Maximum number of improvement iterations before the loop is force-stopped. */
  maxIterations: number;
  /** Minimum milliseconds between successive improvement iterations. */
  cooldownPeriod: number;
}

// ---------------------------------------------------------------------------
// Improvement history — tracked by RecursiveImprover
// ---------------------------------------------------------------------------

export interface ImprovementRecord {
  iteration: number;
  reflection: Reflection;
  codeBefore: string;
  codeAfter: string;
  timestamp: number;
}

export interface ImprovementResult {
  finalCode: string;
  history: ImprovementRecord[];
  totalIterations: number;
  /** True if the loop was stopped by a safety guard rather than natural completion. */
  safetyIntervened: boolean;
}

// ---------------------------------------------------------------------------
// SafetyGuard internal state
// ---------------------------------------------------------------------------

export interface SafetyGuardStatus {
  iterationCount: number;
  canProceed: boolean;
  lastIterationTime: number;
  cooldownRemaining: number;
}
