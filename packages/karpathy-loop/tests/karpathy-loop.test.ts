import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OvernightScheduler } from '../src/overnight-scheduler.js';
import { CodePatcher } from '../src/code-patcher.js';
import { TestRunner } from '../src/test-runner.js';
import { createLLMClient, hashContent } from '../src/utils.js';
import type { ScheduleConfig, LoopOptions } from '../src/types.js';

// Mock fs modules for CodePatcher
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('original content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ─── OvernightScheduler Tests ──────────────────────────────────

describe('OvernightScheduler', () => {
  it('should create a scheduler with config', () => {
    const config: ScheduleConfig = {
      enabled: true,
      startTime: new Date(Date.now() + 3600_000).toISOString(),
      maxIterations: 5,
      cooldownMinutes: 5,
    };
    const scheduler = new OvernightScheduler(config);
    expect(scheduler).toBeDefined();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('should start and immediately execute if start time is in the past', async () => {
    let executed = false;
    const config: ScheduleConfig = {
      enabled: true,
      startTime: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      maxIterations: 1,
      cooldownMinutes: 0,
    };

    const scheduler = new OvernightScheduler(config);
    const started = await scheduler.start(async () => {
      executed = true;
    });

    expect(started).toBe(true);
    // Should have executed immediately since start time is in the past
    expect(executed).toBe(true);
  });

  it('should not start if already running', async () => {
    const config: ScheduleConfig = {
      enabled: true,
      startTime: new Date(Date.now() + 3_600_000).toISOString(),
      maxIterations: 1,
      cooldownMinutes: 0,
    };

    const scheduler = new OvernightScheduler(config);
    const started1 = await scheduler.start(async () => {});
    const started2 = await scheduler.start(async () => {});

    expect(started1).toBe(true);
    expect(started2).toBe(false); // Already running

    scheduler.stop();
  });

  it('should return false when disabled', async () => {
    const config: ScheduleConfig = {
      enabled: false,
      startTime: new Date().toISOString(),
      maxIterations: 1,
      cooldownMinutes: 0,
    };

    const scheduler = new OvernightScheduler(config);
    const started = await scheduler.start(async () => {});
    expect(started).toBe(false);
  });

  it('should stop the scheduler', async () => {
    const config: ScheduleConfig = {
      enabled: true,
      startTime: new Date(Date.now() + 3_600_000).toISOString(),
      maxIterations: 5,
      cooldownMinutes: 5,
    };

    const scheduler = new OvernightScheduler(config);
    await scheduler.start(async () => {});
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('should run now when called', async () => {
    let count = 0;
    const config: ScheduleConfig = {
      enabled: true,
      startTime: new Date(Date.now() + 3_600_000).toISOString(),
      maxIterations: 1,
      cooldownMinutes: 0,
    };
    const scheduler = new OvernightScheduler(config);
    await scheduler.start(async () => { count++; });
    await scheduler.runNow();
    // start() schedules for future time, runNow() executes once
    expect(count).toBe(1);
    scheduler.stop();
  });

  it('should return next execution time', () => {
    const futureTime = new Date(Date.now() + 3_600_000).toISOString();
    const config: ScheduleConfig = {
      enabled: true,
      startTime: futureTime,
      maxIterations: 1,
      cooldownMinutes: 0,
    };

    const scheduler = new OvernightScheduler(config);
    const next = scheduler.getNextExecutionTime();
    expect(next).not.toBeNull();
  });

  it('should return null for next execution time when disabled', () => {
    const config: ScheduleConfig = {
      enabled: false,
      startTime: new Date().toISOString(),
      maxIterations: 1,
      cooldownMinutes: 0,
    };

    const scheduler = new OvernightScheduler(config);
    expect(scheduler.getNextExecutionTime()).toBeNull();
  });
});

// ─── CodePatcher Tests ─────────────────────────────────────────

describe('CodePatcher', () => {
  it('should apply a patch and return previous content', async () => {
    const patcher = new CodePatcher();
    const previous = await patcher.applyPatch({
      filePath: '/test/file.ts',
      content: 'new content',
      description: 'update',
    });
    expect(previous).toBe('original content');
  });

  it('should track backed up files', async () => {
    const patcher = new CodePatcher();
    await patcher.applyPatch({
      filePath: '/test/file.ts',
      content: 'new',
      description: 'test',
    });
    expect(patcher.hasBackup('/test/file.ts')).toBe(true);
    expect(patcher.getBackedUpFiles()).toContain('/test/file.ts');
  });

  it('should rollback a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    const patcher = new CodePatcher();
    await patcher.applyPatch({
      filePath: '/test/file.ts',
      content: 'new',
      description: 'test',
    });

    const rolledBack = await patcher.rollback('/test/file.ts');
    expect(rolledBack).toBe(true);
    expect(patcher.hasBackup('/test/file.ts')).toBe(false);
    expect(writeFile).toHaveBeenCalledWith('/test/file.ts', 'original content', 'utf-8');
  });

  it('should return false when rolling back non-existent backup', async () => {
    const patcher = new CodePatcher();
    const result = await patcher.rollback('/non-existent');
    expect(result).toBe(false);
  });

  it('should clear all backups', async () => {
    const patcher = new CodePatcher();
    await patcher.applyPatch({
      filePath: '/test/file.ts',
      content: 'new',
      description: 'test',
    });
    patcher.clearBackups();
    expect(patcher.hasBackup('/test/file.ts')).toBe(false);
    expect(patcher.getBackedUpFiles().length).toBe(0);
  });
});

// ─── TestRunner Tests ──────────────────────────────────────────

describe('TestRunner', () => {
  it('should validate correct syntax', async () => {
    const runner = new TestRunner();
    const result = await runner.validateSyntax('function test() { return 1; }');
    expect(result.passed).toBe(true);
  });

  it('should detect syntax errors', async () => {
    const runner = new TestRunner();
    const result = await runner.validateSyntax('function test( { return 1; }');
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Syntax error');
  });
});

// ─── Utils Tests ───────────────────────────────────────────────

describe('Utils', () => {
  it('should create an LLM client', () => {
    const client = createLLMClient('test-model');
    expect(client).toBeDefined();
    expect(typeof client.generate).toBe('function');
  });

  it('should generate a mock response from LLM client', async () => {
    const client = createLLMClient();
    const response = await client.generate('test prompt');
    expect(response).toContain('Generated code improvement');
  });

  it('should hash content consistently', () => {
    const hash1 = hashContent('hello world');
    const hash2 = hashContent('hello world');
    const hash3 = hashContent('different content');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toBeGreaterThanOrEqual(0);
  });
});
