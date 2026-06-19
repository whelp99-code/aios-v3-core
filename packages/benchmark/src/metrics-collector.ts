/**
 * MetricsCollector
 * 메트릭 수집기
 */

import { PerformanceMetrics, EvolutionMetrics, StabilityMetrics } from './types.js';

export class MetricsCollector {
  private performanceHistory: PerformanceMetrics[] = [];
  private evolutionHistory: EvolutionMetrics[] = [];
  private stabilityHistory: StabilityMetrics[] = [];

  /**
   * 성능 메트릭 기록
   */
  recordPerformance(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);
  }

  /**
   * 진화 메트릭 기록
   */
  recordEvolution(metrics: EvolutionMetrics): void {
    this.evolutionHistory.push(metrics);
  }

  /**
   * 안정성 메트릭 기록
   */
  recordStability(metrics: StabilityMetrics): void {
    this.stabilityHistory.push(metrics);
  }

  /**
   * 평균 성능 메트릭
   */
  getAveragePerformance(): PerformanceMetrics {
    if (this.performanceHistory.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        latencyMs: 0,
        throughput: 0,
      };
    }

    const sum = this.performanceHistory.reduce(
      (acc, m) => ({
        accuracy: acc.accuracy + m.accuracy,
        precision: acc.precision + m.precision,
        recall: acc.recall + m.recall,
        f1Score: acc.f1Score + m.f1Score,
        latencyMs: acc.latencyMs + m.latencyMs,
        throughput: acc.throughput + m.throughput,
      }),
      { accuracy: 0, precision: 0, recall: 0, f1Score: 0, latencyMs: 0, throughput: 0 }
    );

    const count = this.performanceHistory.length;

    return {
      accuracy: sum.accuracy / count,
      precision: sum.precision / count,
      recall: sum.recall / count,
      f1Score: sum.f1Score / count,
      latencyMs: sum.latencyMs / count,
      throughput: sum.throughput / count,
    };
  }

  /**
   * 평균 진화 메트릭
   */
  getAverageEvolution(): EvolutionMetrics {
    if (this.evolutionHistory.length === 0) {
      return {
        reward: 0,
        improvement: 0,
        iterations: 0,
        convergenceRate: 0,
      };
    }

    const sum = this.evolutionHistory.reduce(
      (acc, m) => ({
        reward: acc.reward + m.reward,
        improvement: acc.improvement + m.improvement,
        iterations: acc.iterations + m.iterations,
        convergenceRate: acc.convergenceRate + m.convergenceRate,
      }),
      { reward: 0, improvement: 0, iterations: 0, convergenceRate: 0 }
    );

    const count = this.evolutionHistory.length;

    return {
      reward: sum.reward / count,
      improvement: sum.improvement / count,
      iterations: sum.iterations / count,
      convergenceRate: sum.convergenceRate / count,
    };
  }

  /**
   * 평균 안정성 메트릭
   */
  getAverageStability(): StabilityMetrics {
    if (this.stabilityHistory.length === 0) {
      return {
        consistency: 0,
        errorRate: 0,
        timeoutRate: 0,
        oomRate: 0,
      };
    }

    const sum = this.stabilityHistory.reduce(
      (acc, m) => ({
        consistency: acc.consistency + m.consistency,
        errorRate: acc.errorRate + m.errorRate,
        timeoutRate: acc.timeoutRate + m.timeoutRate,
        oomRate: acc.oomRate + m.oomRate,
      }),
      { consistency: 0, errorRate: 0, timeoutRate: 0, oomRate: 0 }
    );

    const count = this.stabilityHistory.length;

    return {
      consistency: sum.consistency / count,
      errorRate: sum.errorRate / count,
      timeoutRate: sum.timeoutRate / count,
      oomRate: sum.oomRate / count,
    };
  }

  /**
   * 전체 메트릭 조회
   */
  getAllMetrics(): {
    performance: PerformanceMetrics;
    evolution: EvolutionMetrics;
    stability: StabilityMetrics;
  } {
    return {
      performance: this.getAveragePerformance(),
      evolution: this.getAverageEvolution(),
      stability: this.getAverageStability(),
    };
  }

  /**
   * 히스토리 초기화
   */
  clearHistory(): void {
    this.performanceHistory = [];
    this.evolutionHistory = [];
    this.stabilityHistory = [];
  }
}
