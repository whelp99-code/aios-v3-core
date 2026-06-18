import type { MetaContext, Reflection } from "./types.js";

/**
 * MetaCognitiveAgent — the "meta" layer that sits above a task agent.
 *
 * It never executes the task itself. Instead it:
 *   1. **reflects** on the task agent's output and context.
 *   2. **self-modifies** by validating and applying a code patch.
 *   3. **recursively improves** the agent until a max depth is reached.
 */
export class MetaCognitiveAgent {
  private readonly maxRecursiveDepth: number;

  constructor(options?: { maxRecursiveDepth?: number }) {
    this.maxRecursiveDepth = options?.maxRecursiveDepth ?? 5;
  }

  // -----------------------------------------------------------------------
  // reflect — analyse execution and produce a structured Reflection
  // -----------------------------------------------------------------------

  reflect(context: MetaContext): Reflection {
    const { taskInput, executionResult, successRate, recentFailures, currentCode } = context;

    // ---- rule-based heuristic analysis (replaceable with LLM call) --------
    const analysis = this.buildAnalysis(context);
    const rootCause = this.diagnoseRootCause(context);
    const proposal = this.buildProposal(context, rootCause);
    const confidence = this.estimateConfidence(context);

    return {
      analysis,
      rootCause,
      improvementProposal: proposal,
      codePatch: this.generatePatch(context, proposal),
      confidenceScore: confidence,
    };
  }

  // -----------------------------------------------------------------------
  // selfModify — validate a reflection's patch and apply it
  // -----------------------------------------------------------------------

  selfModify(reflection: Reflection, currentCode: string): string {
    if (reflection.confidenceScore < 0.3) {
      throw new Error(
        `Confidence too low (${reflection.confidenceScore.toFixed(2)}). ` +
          "Aborting self-modification to avoid degrading the codebase.",
      );
    }

    if (!reflection.codePatch || reflection.codePatch.trim().length === 0) {
      throw new Error("Reflection contains an empty codePatch. Nothing to apply.");
    }

    return this.applyPatch(currentCode, reflection.codePatch);
  }

  // -----------------------------------------------------------------------
  // recursiveImprove — iterative improvement up to max depth
  // -----------------------------------------------------------------------

  recursiveImprove(
    context: MetaContext,
    apply: (code: string) => string,
    shouldContinue?: (reflection: Reflection) => boolean,
  ): { code: string; depth: number; reflections: Reflection[] } {
    let code = context.currentCode;
    const reflections: Reflection[] = [];
    let depth = 0;

    while (depth < this.maxRecursiveDepth) {
      const ctx: MetaContext = { ...context, currentCode: code };
      const reflection = this.reflect(ctx);
      reflections.push(reflection);

      if (reflection.confidenceScore < 0.5) {
        break;
      }

      if (shouldContinue && !shouldContinue(reflection)) {
        break;
      }

      code = this.selfModify(reflection, code);
      code = apply(code);
      depth += 1;
    }

    return { code, depth, reflections };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private buildAnalysis(ctx: MetaContext): string {
    const successPct = (ctx.successRate * 100).toFixed(1);
    const failureCount = ctx.recentFailures.length;

    if (failureCount === 0 && ctx.successRate >= 0.9) {
      return (
        `Task "${ctx.taskInput}" is performing well. ` +
        `Success rate is ${successPct}% with no recent failures.`
      );
    }

    if (failureCount > 0) {
      const latest = ctx.recentFailures[0];
      return (
        `Task "${ctx.taskInput}" has a success rate of ${successPct}% ` +
        `with ${failureCount} recent failure(s). Latest: "${latest}".`
      );
    }

    return (
      `Task "${ctx.taskInput}" has a moderate success rate of ${successPct}%. ` +
      "There may be room for improvement."
    );
  }

  private diagnoseRootCause(ctx: MetaContext): string {
    if (ctx.recentFailures.length > 0) {
      return `Repeated failures indicate the current approach is insufficient: ${ctx.recentFailures[0]}`;
    }
    if (ctx.successRate < 0.5) {
      return "Success rate is critically low; the strategy likely needs a fundamental change.";
    }
    if (ctx.successRate < 0.8) {
      return "Performance is sub-optimal; incremental improvements should raise reliability.";
    }
    return "No critical issue detected; continuing with minor optimisations.";
  }

  private buildProposal(_ctx: MetaContext, rootCause: string): string {
    if (rootCause.includes("fundamental change")) {
      return "Propose an alternative algorithm or strategy entirely.";
    }
    if (rootCause.includes("insufficient")) {
      return "Add retry logic, better error handling, and input validation.";
    }
    if (rootCause.includes("incremental")) {
      return "Refactor for clarity, add micro-benchmarks, and tune parameters.";
    }
    return "Maintain current approach; apply minor code-quality improvements.";
  }

  private estimateConfidence(ctx: MetaContext): number {
    if (ctx.recentFailures.length === 0 && ctx.successRate >= 0.9) {
      return 0.95;
    }
    if (ctx.recentFailures.length > 2) {
      return 0.4;
    }
    return 0.7;
  }

  private generatePatch(_ctx: MetaContext, proposal: string): string {
    // In a production system this would call an LLM to produce a real diff.
    // Here we emit a placeholder patch that encodes the proposal intent.
    return [
      "// Auto-generated patch by MetaCognitiveAgent",
      `// Proposal: ${proposal}`,
      "// --- apply changes below ---",
      "",
    ].join("\n");
  }

  private applyPatch(currentCode: string, patch: string): string {
    // In production this would parse unified diffs. For now we append.
    return currentCode + "\n\n" + patch;
  }
}
