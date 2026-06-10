import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaCognitiveAgent } from '../src/meta-cognitive-agent.js';
import { SafetyGuard } from '../src/safety-guard.js';
import { RecursiveImprover } from '../src/recursive-improver.js';
import type { MetaContext, SafetyConfig } from '../src/types.js';

// ─── MetaCognitiveAgent Tests ──────────────────────────────────

describe('MetaCognitiveAgent', () => {
  const makeContext = (overrides: Partial<MetaContext> = {}): MetaContext => ({
    taskInput: 'sort an array',
    executionResult: 'Array sorted successfully',
    successRate: 0.9,
    recentFailures: [],
    currentCode: 'function sort(arr) { return arr.sort(); }',
    ...overrides,
  });

  it('should create with default options', () => {
    const agent = new MetaCognitiveAgent();
    expect(agent).toBeDefined();
  });

  it('should create with custom maxRecursiveDepth', () => {
    const agent = new MetaCognitiveAgent({ maxRecursiveDepth: 10 });
    expect(agent).toBeDefined();
  });

  it('should produce a reflection for a well-performing task', () => {
    const agent = new MetaCognitiveAgent();
    const ctx = makeContext({ successRate: 0.95, recentFailures: [] });
    const reflection = agent.reflect(ctx);

    expect(reflection.analysis).toContain('performing well');
    expect(reflection.confidenceScore).toBe(0.95);
    expect(reflection.codePatch).toBeDefined();
    expect(reflection.codePatch.length).toBeGreaterThan(0);
  });

  it('should produce a reflection for a failing task', () => {
    const agent = new MetaCognitiveAgent();
    const ctx = makeContext({
      successRate: 0.4,
      recentFailures: ['Index out of bounds', 'Timeout exceeded'],
    });
    const reflection = agent.reflect(ctx);

    expect(reflection.analysis).toContain('failure');
    expect(reflection.rootCause).toContain('insufficient');
    // With 2 recent failures, confidence is 0.7 (not > 2)
    expect(reflection.confidenceScore).toBe(0.7);
  });

  it('should produce a reflection for moderate performance', () => {
    const agent = new MetaCognitiveAgent();
    const ctx = makeContext({ successRate: 0.75, recentFailures: [] });
    const reflection = agent.reflect(ctx);

    expect(reflection.analysis).toContain('moderate');
    expect(reflection.confidenceScore).toBe(0.7);
  });

  it('should self-modify with high confidence', () => {
    const agent = new MetaCognitiveAgent();
    const ctx = makeContext({ successRate: 0.95, recentFailures: [] });
    const reflection = agent.reflect(ctx);

    const newCode = agent.selfModify(reflection, 'original code');
    expect(newCode).toContain('original code');
    expect(newCode).toContain('Auto-generated patch');
  });

  it('should reject self-modification with low confidence', () => {
    const agent = new MetaCognitiveAgent();
    const reflection = {
      analysis: 'test',
      rootCause: 'test',
      improvementProposal: 'test',
      codePatch: 'patch',
      confidenceScore: 0.2, // Too low
    };

    expect(() => agent.selfModify(reflection, 'code')).toThrow('Confidence too low');
  });

  it('should reject self-modification with empty patch', () => {
    const agent = new MetaCognitiveAgent();
    const reflection = {
      analysis: 'test',
      rootCause: 'test',
      improvementProposal: 'test',
      codePatch: '   ', // Empty after trim
      confidenceScore: 0.9,
    };

    expect(() => agent.selfModify(reflection, 'code')).toThrow('empty codePatch');
  });

  it('should run recursiveImprove and apply changes', () => {
    const agent = new MetaCognitiveAgent({ maxRecursiveDepth: 3 });
    const ctx = makeContext({ successRate: 0.95, recentFailures: [] });

    const result = agent.recursiveImprove(ctx, (code) => code + '\n// improved');
    expect(result.depth).toBeGreaterThanOrEqual(0);
    expect(result.reflections.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop recursion when confidence drops', () => {
    const agent = new MetaCognitiveAgent({ maxRecursiveDepth: 5 });
    const ctx = makeContext({
      successRate: 0.4,
      recentFailures: ['err1', 'err2', 'err3'],
    });

    const result = agent.recursiveImprove(ctx, (code) => code);
    // Confidence is 0.4 which is < 0.5, so should break immediately
    expect(result.depth).toBe(0);
    expect(result.reflections.length).toBe(1);
  });

  it('should respect shouldContinue callback', () => {
    const agent = new MetaCognitiveAgent({ maxRecursiveDepth: 5 });
    const ctx = makeContext({ successRate: 0.95, recentFailures: [] });

    let callCount = 0;
    const result = agent.recursiveImprove(
      ctx,
      (code) => code,
      () => { callCount++; return callCount < 2; }
    );
    expect(result.depth).toBeLessThanOrEqual(2);
  });
});

// ─── SafetyGuard Tests ─────────────────────────────────────────

describe('SafetyGuard', () => {
  it('should allow proceeding initially', () => {
    const guard = new SafetyGuard({ maxIterations: 5, cooldownPeriod: 1000 });
    expect(guard.canProceed()).toBe(true);
  });

  it('should block after max iterations', () => {
    const guard = new SafetyGuard({ maxIterations: 3, cooldownPeriod: 0 });
    guard.recordIteration();
    guard.recordIteration();
    guard.recordIteration();
    expect(guard.canProceed()).toBe(false);
  });

  it('should enforce cooldown period', () => {
    const guard = new SafetyGuard({ maxIterations: 10, cooldownPeriod: 100_000 }); // Long cooldown
    guard.recordIteration();
    expect(guard.canProceed()).toBe(false); // Still in cooldown
  });

  it('should reset state', () => {
    const guard = new SafetyGuard({ maxIterations: 3, cooldownPeriod: 0 });
    guard.recordIteration();
    guard.recordIteration();
    guard.recordIteration();
    expect(guard.canProceed()).toBe(false);

    guard.reset();
    expect(guard.canProceed()).toBe(true);
  });

  it('should report status', () => {
    const guard = new SafetyGuard({ maxIterations: 5, cooldownPeriod: 1000 });
    const status = guard.getStatus();
    expect(status.iterationCount).toBe(0);
    expect(status.canProceed).toBe(true);
    expect(status.cooldownRemaining).toBe(0);
  });

  it('should track cooldown remaining', () => {
    const guard = new SafetyGuard({ maxIterations: 10, cooldownPeriod: 5000 });
    guard.recordIteration();

    const status = guard.getStatus();
    expect(status.cooldownRemaining).toBeGreaterThan(0);
    expect(status.cooldownRemaining).toBeLessThanOrEqual(5000);
  });
});

// ─── RecursiveImprover Tests ───────────────────────────────────

describe('RecursiveImprover', () => {
  it('should improve code through iterations', async () => {
    const improver = new RecursiveImprover({
      maxIterations: 3,
      cooldownPeriod: 0,
      maxRecursiveDepth: 3,
    });

    const ctx: MetaContext = {
      taskInput: 'optimize function',
      executionResult: 'ok',
      successRate: 0.95,
      recentFailures: [],
      currentCode: 'function fn() { return 1; }',
    };

    const result = await improver.improve(ctx, (code) => code + '\n// patched');
    expect(result.totalIterations).toBeGreaterThanOrEqual(1);
    expect(result.finalCode).toContain('patched');
    expect(result.history.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop when safety guard intervenes', async () => {
    const improver = new RecursiveImprover({
      maxIterations: 2,
      cooldownPeriod: 0,
    });

    const ctx: MetaContext = {
      taskInput: 'task',
      executionResult: 'ok',
      successRate: 0.95,
      recentFailures: [],
      currentCode: 'code',
    };

    const result = await improver.improve(ctx, (code) => code);
    expect(result.totalIterations).toBeLessThanOrEqual(2);
  });

  it('should expose safety status', () => {
    const improver = new RecursiveImprover();
    const status = improver.getSafetyStatus();
    expect(status.iterationCount).toBe(0);
    expect(status.canProceed).toBe(true);
  });

  it('should reset state', async () => {
    const improver = new RecursiveImprover({ maxIterations: 1, cooldownPeriod: 0 });
    const ctx: MetaContext = {
      taskInput: 'task',
      executionResult: 'ok',
      successRate: 0.95,
      recentFailures: [],
      currentCode: 'code',
    };
    await improver.improve(ctx, (code) => code);
    improver.reset();
    const status = improver.getSafetyStatus();
    expect(status.iterationCount).toBe(0);
  });
});
