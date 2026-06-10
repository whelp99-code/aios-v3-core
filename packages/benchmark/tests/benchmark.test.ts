import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkRunner, MetricsCollector, ReportGenerator } from '../src/index.js';
import type { BenchmarkTask, BenchmarkResult, PerformanceMetrics, EvolutionMetrics, StabilityMetrics } from '../src/types.js';

// ─── BenchmarkRunner Tests ─────────────────────────────────────

describe('BenchmarkRunner', () => {
  it('should create a runner with default config', () => {
    const runner = new BenchmarkRunner();
    expect(runner).toBeDefined();
    expect(runner.getResults().length).toBe(0);
  });

  it('should create a runner with custom config', () => {
    const runner = new BenchmarkRunner({ maxConcurrency: 10, timeout: 5000, retries: 5 });
    expect(runner).toBeDefined();
  });

  it('should register and run a single task successfully', async () => {
    const runner = new BenchmarkRunner();
    const task: BenchmarkTask = {
      id: 'task-1',
      name: 'Add Task',
      category: 'math',
      input: { a: 1, b: 2 },
      timeout: 5000,
      tags: ['basic'],
    };
    runner.registerTask(task);

    const results = await runner.run(async (input) => input.a + input.b);
    expect(results.length).toBe(1);
    expect(results[0].taskId).toBe('task-1');
    expect(results[0].success).toBe(true);
    expect(results[0].output).toBe(3);
  });

  it('should handle task failure and retries', async () => {
    const runner = new BenchmarkRunner({ retries: 2 });
    runner.registerTask({
      id: 'failing-task',
      name: 'Failing Task',
      category: 'test',
      input: {},
      timeout: 5000,
      tags: [],
    });

    let attempts = 0;
    const results = await runner.run(async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail');
      return 'ok';
    });
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
  });

  it('should handle task timeout', async () => {
    const runner = new BenchmarkRunner({ retries: 1 });
    runner.registerTask({
      id: 'timeout-task',
      name: 'Timeout Task',
      category: 'test',
      input: {},
      timeout: 100, // 100ms timeout
      tags: [],
    });

    const results = await runner.run(async () => {
      await new Promise((r) => setTimeout(r, 500));
      return 'too slow';
    });
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
  });

  it('should run multiple tasks', async () => {
    const runner = new BenchmarkRunner();
    runner.registerTask({ id: 't1', name: 'Task 1', category: 'a', input: 1, timeout: 5000, tags: [] });
    runner.registerTask({ id: 't2', name: 'Task 2', category: 'a', input: 2, timeout: 5000, tags: [] });
    runner.registerTask({ id: 't3', name: 'Task 3', category: 'a', input: 3, timeout: 5000, tags: [] });

    const results = await runner.run(async (input) => (input as number) * 10);
    expect(results.length).toBe(3);
    expect(results[0].output).toBe(10);
    expect(results[1].output).toBe(20);
    expect(results[2].output).toBe(30);
  });

  it('should clear results', async () => {
    const runner = new BenchmarkRunner();
    runner.registerTask({ id: 't1', name: 'T', category: 'a', input: {}, timeout: 5000, tags: [] });
    await runner.run(async () => 'ok');
    expect(runner.getResults().length).toBe(1);
    runner.clearResults();
    expect(runner.getResults().length).toBe(0);
  });

  it('should calculate correct metrics for successful tasks', async () => {
    const runner = new BenchmarkRunner();
    runner.registerTask({ id: 't1', name: 'T', category: 'a', input: {}, timeout: 5000, tags: [] });
    const results = await runner.run(async () => 'output');
    expect(results[0].metrics.accuracy).toBe(0.8);
    expect(results[0].evolution.reward).toBe(0.8);
    expect(results[0].stability.consistency).toBe(1);
    expect(results[0].stability.errorRate).toBe(0);
  });
});

// ─── MetricsCollector Tests ────────────────────────────────────

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should record and average performance metrics', () => {
    collector.recordPerformance({ accuracy: 0.9, precision: 0.85, recall: 0.8, f1Score: 0.82, latencyMs: 100, throughput: 50 });
    collector.recordPerformance({ accuracy: 0.7, precision: 0.65, recall: 0.6, f1Score: 0.62, latencyMs: 200, throughput: 25 });

    const avg = collector.getAveragePerformance();
    expect(avg.accuracy).toBe(0.8);
    expect(avg.precision).toBe(0.75);
    expect(avg.latencyMs).toBe(150);
    expect(avg.throughput).toBe(37.5);
  });

  it('should return zeros for empty performance history', () => {
    const avg = collector.getAveragePerformance();
    expect(avg.accuracy).toBe(0);
    expect(avg.throughput).toBe(0);
  });

  it('should record and average evolution metrics', () => {
    collector.recordEvolution({ reward: 0.8, improvement: 0.2, iterations: 5, convergenceRate: 0.9 });
    collector.recordEvolution({ reward: 0.6, improvement: 0.1, iterations: 3, convergenceRate: 0.7 });

    const avg = collector.getAverageEvolution();
    expect(avg.reward).toBe(0.7);
    expect(avg.improvement).toBeCloseTo(0.15);
    expect(avg.iterations).toBe(4);
    expect(avg.convergenceRate).toBe(0.8);
  });

  it('should return zeros for empty evolution history', () => {
    const avg = collector.getAverageEvolution();
    expect(avg.reward).toBe(0);
    expect(avg.iterations).toBe(0);
  });

  it('should record and average stability metrics', () => {
    collector.recordStability({ consistency: 0.9, errorRate: 0.1, timeoutRate: 0.05, oomRate: 0 });
    collector.recordStability({ consistency: 0.7, errorRate: 0.3, timeoutRate: 0.1, oomRate: 0.02 });

    const avg = collector.getAverageStability();
    expect(avg.consistency).toBe(0.8);
    expect(avg.errorRate).toBe(0.2);
    expect(avg.timeoutRate).toBeCloseTo(0.075);
  });

  it('should return zeros for empty stability history', () => {
    const avg = collector.getAverageStability();
    expect(avg.consistency).toBe(0);
    expect(avg.errorRate).toBe(0);
  });

  it('should get all metrics combined', () => {
    collector.recordPerformance({ accuracy: 0.9, precision: 0.9, recall: 0.9, f1Score: 0.9, latencyMs: 100, throughput: 50 });
    collector.recordEvolution({ reward: 0.8, improvement: 0.1, iterations: 2, convergenceRate: 0.7 });
    collector.recordStability({ consistency: 1, errorRate: 0, timeoutRate: 0, oomRate: 0 });

    const all = collector.getAllMetrics();
    expect(all.performance.accuracy).toBe(0.9);
    expect(all.evolution.reward).toBe(0.8);
    expect(all.stability.consistency).toBe(1);
  });

  it('should clear history', () => {
    collector.recordPerformance({ accuracy: 0.9, precision: 0.9, recall: 0.9, f1Score: 0.9, latencyMs: 100, throughput: 50 });
    collector.recordEvolution({ reward: 0.8, improvement: 0.1, iterations: 2, convergenceRate: 0.7 });
    collector.recordStability({ consistency: 1, errorRate: 0, timeoutRate: 0, oomRate: 0 });
    collector.clearHistory();
    const all = collector.getAllMetrics();
    expect(all.performance.accuracy).toBe(0);
    expect(all.evolution.reward).toBe(0);
    expect(all.stability.consistency).toBe(0);
  });
});

// ─── ReportGenerator Tests ─────────────────────────────────────

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  it('should generate a report from results', () => {
    const results: BenchmarkResult[] = [
      {
        taskId: 't1', taskName: 'Task 1', success: true, output: 'a',
        metrics: { accuracy: 0.9, precision: 0.9, recall: 0.9, f1Score: 0.9, latencyMs: 100, throughput: 50 },
        evolution: { reward: 0.8, improvement: 0.1, iterations: 1, convergenceRate: 0.5 },
        stability: { consistency: 1, errorRate: 0, timeoutRate: 0, oomRate: 0 },
        timestamp: new Date(), durationMs: 100,
      },
      {
        taskId: 't2', taskName: 'Task 2', success: true, output: 'b',
        metrics: { accuracy: 0.7, precision: 0.7, recall: 0.7, f1Score: 0.7, latencyMs: 200, throughput: 25 },
        evolution: { reward: 0.6, improvement: 0.05, iterations: 1, convergenceRate: 0.3 },
        stability: { consistency: 1, errorRate: 0, timeoutRate: 0, oomRate: 0 },
        timestamp: new Date(), durationMs: 200,
      },
    ];

    const report = generator.generateReport(results);
    expect(report.taskCount).toBe(2);
    expect(report.successRate).toBe(1.0);
    expect(report.averageLatency).toBe(150);
    expect(report.averageReward).toBe(0.7);
    expect(report.summary).toContain('벤치마크 리포트 요약');
    expect(report.results).toBe(results);
  });

  it('should handle empty results', () => {
    const report = generator.generateReport([]);
    expect(report.taskCount).toBe(0);
    expect(report.successRate).toBe(0);
    expect(report.averageLatency).toBe(0);
    expect(report.averageReward).toBe(0);
  });

  it('should generate JSON report', () => {
    const results: BenchmarkResult[] = [
      {
        taskId: 't1', taskName: 'T', success: true, output: null,
        metrics: { accuracy: 0, precision: 0, recall: 0, f1Score: 0, latencyMs: 0, throughput: 0 },
        evolution: { reward: 0, improvement: 0, iterations: 0, convergenceRate: 0 },
        stability: { consistency: 0, errorRate: 0, timeoutRate: 0, oomRate: 0 },
        timestamp: new Date(), durationMs: 0,
      },
    ];
    const jsonStr = generator.generateJSONReport(results);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.taskCount).toBe(1);
  });

  it('should generate markdown report', () => {
    const results: BenchmarkResult[] = [
      {
        taskId: 't1', taskName: 'My Task', success: true, output: 'ok',
        metrics: { accuracy: 0.9, precision: 0.9, recall: 0.9, f1Score: 0.9, latencyMs: 50, throughput: 100 },
        evolution: { reward: 0.9, improvement: 0.2, iterations: 1, convergenceRate: 0.8 },
        stability: { consistency: 1, errorRate: 0, timeoutRate: 0, oomRate: 0 },
        timestamp: new Date(), durationMs: 50,
      },
    ];
    const md = generator.generateMarkdownReport(results);
    expect(md).toContain('벤치마크 리포트');
    expect(md).toContain('My Task');
    expect(md).toContain('요약');
  });
});
