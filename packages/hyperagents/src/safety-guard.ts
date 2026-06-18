import type { SafetyConfig, SafetyGuardStatus } from "./types.js";

/**
 * SafetyGuard — protects the recursive improvement loop from runaway
 * iterations. Tracks how many times the loop has run, enforces a
 * cooldown between iterations, and can be reset at any time.
 */
export class SafetyGuard {
  private iterationCount = 0;
  private lastIterationTime = 0;
  private readonly config: SafetyConfig;

  constructor(config: SafetyConfig) {
    this.config = { ...config };
  }

  /**
   * Returns `true` when the loop may continue: iteration count is
   * below the maximum AND the cooldown period has elapsed.
   */
  canProceed(): boolean {
    if (this.iterationCount >= this.config.maxIterations) {
      return false;
    }

    if (this.lastIterationTime > 0) {
      const elapsed = Date.now() - this.lastIterationTime;
      if (elapsed < this.config.cooldownPeriod) {
        return false;
      }
    }

    return true;
  }

  /**
   * Call after each successful iteration to bump the counter and
   * record the timestamp for cooldown enforcement.
   */
  recordIteration(): void {
    this.iterationCount += 1;
    this.lastIterationTime = Date.now();
  }

  /** Reset all internal state so the guard is ready for a new run. */
  reset(): void {
    this.iterationCount = 0;
    this.lastIterationTime = 0;
  }

  /** Return a snapshot of the current guard state. */
  getStatus(): SafetyGuardStatus {
    const now = Date.now();
    const cooldownRemaining =
      this.lastIterationTime > 0
        ? Math.max(0, this.config.cooldownPeriod - (now - this.lastIterationTime))
        : 0;

    return {
      iterationCount: this.iterationCount,
      canProceed: this.canProceed(),
      lastIterationTime: this.lastIterationTime,
      cooldownRemaining,
    };
  }
}
