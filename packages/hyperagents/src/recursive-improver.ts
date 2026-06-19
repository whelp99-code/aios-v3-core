import { MetaCognitiveAgent } from "./meta-cognitive-agent.js";
import { SafetyGuard } from "./safety-guard.js";
import type {
  ImprovementRecord,
  ImprovementResult,
  MetaContext,
  SafetyConfig,
} from "./types.js";

/**
 * RecursiveImprover — orchestrates the reflect → patch → apply loop
 * while respecting a SafetyGuard to prevent runaway recursion.
 *
 * Usage:
 * ```ts
 * const improver = new RecursiveImprover();
 * const result = await improver.improve(initialContext, applyFn);
 * console.log(result.finalCode);
 * ```
 */
export class RecursiveImprover {
  private readonly metaAgent: MetaCognitiveAgent;
  private readonly safetyGuard: SafetyGuard;

  constructor(options?: {
    maxIterations?: number;
    cooldownPeriod?: number;
    maxRecursiveDepth?: number;
  }) {
    this.metaAgent = new MetaCognitiveAgent({
      maxRecursiveDepth: options?.maxRecursiveDepth ?? 10,
    });

    const safetyConfig: SafetyConfig = {
      maxIterations: options?.maxIterations ?? 10,
      cooldownPeriod: options?.cooldownPeriod ?? 100,
    };
    this.safetyGuard = new SafetyGuard(safetyConfig);
  }

  /**
   * Run the improvement loop.
   *
   * @param context - Initial execution context.
   * @param apply   - Function that takes patched code, applies it
   *                  (e.g. writing to disk or reloading a module), and
   *                  returns the possibly-adjusted code string.
   * @returns       - Final code plus full improvement history.
   */
  async improve(
    context: MetaContext,
    apply: (code: string) => string | Promise<string>,
  ): Promise<ImprovementResult> {
    this.safetyGuard.reset();

    let currentCode = context.currentCode;
    const history: ImprovementRecord[] = [];
    let safetyIntervened = false;

    while (this.safetyGuard.canProceed()) {
      // Reflect
      const currentContext: MetaContext = { ...context, currentCode };
      const reflection = this.metaAgent.reflect(currentContext);

      // Decide whether to continue
      if (reflection.confidenceScore < 0.5) {
        break;
      }

      // Self-modify
      const patchedCode = this.metaAgent.selfModify(reflection, currentCode);

      // External apply hook
      const appliedCode = typeof apply === "function" ? await apply(patchedCode) : patchedCode;

      // Record
      const record: ImprovementRecord = {
        iteration: history.length + 1,
        reflection,
        codeBefore: currentCode,
        codeAfter: appliedCode,
        timestamp: Date.now(),
      };
      history.push(record);

      // Track in safety guard
      this.safetyGuard.recordIteration();

      currentCode = appliedCode;
    }

    if (!this.safetyGuard.canProceed() && history.length > 0) {
      safetyIntervened = true;
    }

    return {
      finalCode: currentCode,
      history,
      totalIterations: history.length,
      safetyIntervened,
    };
  }

  /** Expose the underlying safety guard for external monitoring. */
  getSafetyStatus() {
    return this.safetyGuard.getStatus();
  }

  /** Reset both the safety guard and meta-agent state for a new run. */
  reset(): void {
    this.safetyGuard.reset();
  }
}
