/**
 * 벤치마크 타입 정의
 */

export interface BenchmarkTask {
  id: string;
  name: string;
  category: string;
  input: any;
  expectedOutput?: any;
  timeout: number;
  tags: string[];
}

export interface BenchmarkResult {
  taskId: string;
  taskName: string;
  success: boolean;
  output: any;
  metrics: PerformanceMetrics;
  evolution: EvolutionMetrics;
  stability: StabilityMetrics;
  timestamp: Date;
  durationMs: number;
}

export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latencyMs: number;
  throughput: number;
}

export interface EvolutionMetrics {
  reward: number;
  improvement: number;
  iterations: number;
  convergenceRate: number;
}

export interface StabilityMetrics {
  consistency: number;
  errorRate: number;
  timeoutRate: number;
  oomRate: number;
}

export interface BenchmarkReport {
  taskCount: number;
  successRate: number;
  averageLatency: number;
  averageReward: number;
  results: BenchmarkResult[];
  summary: string;
}
