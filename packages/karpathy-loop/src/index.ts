/**
 * @aios/karpathy-loop
 *
 * Karpathy-style automatic learning loop for iterative code improvement.
 *
 * This package implements Andrej Karpathy's approach to automated code
 * improvement through iterative feedback loops. The system:
 *
 * 1. Analyzes existing code
 * 2. Proposes improvements via LLM
 * 3. Generates code patches
 * 4. Tests the patches in isolation
 * 5. Commits improvements that pass tests
 * 6. Rolls back failed attempts
 * 7. Repeats until max iterations reached
 *
 * @example
 * ```typescript
 * import { KarpathyLoop, OvernightScheduler, CodePatcher } from '@aios/karpathy-loop';
 *
 * const loop = new KarpathyLoop({
 *   codebasePath: './src/main.ts',
 *   maxIterations: 10,
 *   improvementThreshold: 0.1,
 * });
 *
 * const report = await loop.run();
 * console.log(`Committed ${report.committedCount} improvements`);
 * ```
 *
 * @packageDocumentation
 */

// Main loop class
export { KarpathyLoop } from './karpathy-loop.js';

// Scheduling
export { OvernightScheduler } from './overnight-scheduler.js';

// Code patching
export { CodePatcher } from './code-patcher.js';

// Test running
export { TestRunner } from './test-runner.js';

// Types
export type {
  LoopIteration,
  LoopReport,
  ScheduleConfig,
  LoopOptions,
  TestResult,
  Proposal,
  CodePatch,
} from './types.js';

// Utilities
export { createLLMClient, readFile, writeFile, hashContent } from './utils.js';
export type { LLMClient } from './utils.js';
