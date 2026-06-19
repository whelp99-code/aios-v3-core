/**
 * BenchmarkRunner
 * 벤치마크 실행 엔진
 */

import { BenchmarkTask, BenchmarkResult, PerformanceMetrics, EvolutionMetrics, StabilityMetrics } from './types.js';

export interface BenchmarkRunnerConfig {
  maxConcurrency: number;
  timeout: number;
  retries: number;
}

export class BenchmarkRunner {
  private config: BenchmarkRunnerConfig;
  private tasks: BenchmarkTask[] = [];
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<BenchmarkRunnerConfig> = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 5,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };
  }

  /**
   * 태스크 등록
   */
  registerTask(task: BenchmarkTask): void {
    this.tasks.push(task);
  }

  /**
   * 벤치마크 실행
   */
  async run(
    handler: (input: unknown) => Promise<unknown>
  ): Promise<BenchmarkResult[]> {
    this.results = [];

    for (const task of this.tasks) {
      const result = await this.runTask(task, handler);
      this.results.push(result);
    }

    return this.results;
  }

  /**
   * 단일 태스크 실행
   */
  private async runTask(
    task: BenchmarkTask,
    handler: (input: unknown) => Promise<unknown>
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let success = false;
    let output: unknown = null;
    let error: string | undefined;

    for (let i = 0; i < this.config.retries; i++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), task.timeout)
        );

        output = await Promise.race([
          handler(task.input),
          timeoutPromise,
        ]);

        success = true;
        break;
      } catch (e) {
        error = String(e);
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      taskId: task.id,
      taskName: task.name,
      success,
      output,
      metrics: this.calculateMetrics(task, output),
      evolution: this.calculateEvolution(task, output),
      stability: this.calculateStability(task, success, durationMs),
      timestamp: new Date(),
      durationMs,
    };
  }

  /**
   * 성능 메트릭 계산
   */
  private calculateMetrics(task: BenchmarkTask, output: unknown): PerformanceMetrics {
    // 단순 정확도 계산 (실제로는 더 정교한 계산 필요)
    const accuracy = output ? 0.8 : 0;

    return {
      accuracy,
      precision: accuracy,
      recall: accuracy,
      f1Score: accuracy,
      latencyMs: 0,
      throughput: 0,
    };
  }

  /**
   * 진화 메트릭 계산
   */
  private calculateEvolution(task: BenchmarkTask, output: unknown): EvolutionMetrics {
    return {
      reward: output ? 0.8 : 0,
      improvement: 0,
      iterations: 1,
      convergenceRate: 0,
    };
  }

  /**
   * 안정성 메트릭 계산
   */
  private calculateStability(
    task: BenchmarkTask,
    success: boolean,
    durationMs: number
  ): StabilityMetrics {
    return {
      consistency: success ? 1 : 0,
      errorRate: success ? 0 : 1,
      timeoutRate: durationMs > task.timeout ? 1 : 0,
      oomRate: 0,
    };
  }

  /**
   * 결과 조회
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * 결과 초기화
   */
  clearResults(): void {
    this.results = [];
  }
}
