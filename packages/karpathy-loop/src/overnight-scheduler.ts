import { ScheduleConfig } from './types.js';

/**
 * OvernightScheduler handles scheduling the learning loop
 * to run at specific times (e.g., overnight).
 *
 * Uses setTimeout to schedule execution and supports
 * immediate execution via runNow().
 */
export class OvernightScheduler {
  private config: ScheduleConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: boolean = false;
  private executionFn: (() => Promise<void>) | null = null;

  constructor(config: ScheduleConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler. Schedules execution at the configured time.
   *
   * @param executionFn - The function to execute when the schedule triggers
   * @returns true if scheduling was successful
   */
  async start(executionFn: () => Promise<void>): Promise<boolean> {
    if (this.running) {
      return false;
    }

    this.executionFn = executionFn;
    this.running = true;

    if (!this.config.enabled) {
      return false;
    }

    const startTime = new Date(this.config.startTime);
    const now = new Date();

    if (startTime <= now) {
      // Start time is in the past, execute immediately
      await this.runNow();
      return true;
    }

    // Calculate delay until start time
    const delay = startTime.getTime() - now.getTime();

    this.timer = setTimeout(async () => {
      await this.runLoop();
    }, delay);

    return true;
  }

  /**
   * Stop the scheduler and cancel any pending execution.
   */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.executionFn = null;
  }

  /**
   * Execute the scheduled function immediately.
   */
  async runNow(): Promise<void> {
    if (this.executionFn) {
      await this.executionFn();
    }
  }

  /**
   * Run the learning loop with cooldown between iterations.
   */
  private async runLoop(): Promise<void> {
    if (!this.executionFn || !this.running) {
      return;
    }

    for (let i = 0; i < this.config.maxIterations; i++) {
      if (!this.running) {
        break;
      }

      await this.executionFn();

      // Apply cooldown between iterations (except after last)
      if (i < this.config.maxIterations - 1 && this.running) {
        await this.sleep(this.config.cooldownMinutes * 60 * 1000);
      }
    }
  }

  /**
   * Check if the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the next scheduled execution time.
   */
  getNextExecutionTime(): Date | null {
    if (!this.config.enabled) {
      return null;
    }
    return new Date(this.config.startTime);
  }

  /**
   * Utility: sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
