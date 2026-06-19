/**
 * Configuration for a sandbox container execution environment.
 *
 * Security-first defaults: network disabled, read-only rootfs, memory cap,
 * and CPU quota enforced at container creation time.
 */
export interface SandboxConfig {
  /** Maximum memory limit for the container (e.g. "256m", "1g"). Default: "256m" */
  memoryLimit?: string;

  /** CPU quota as a proportion of one CPU (e.g. 0.5 = half a CPU). Default: 0.5 */
  cpuQuota?: number;

  /** Execution timeout in milliseconds. Default: 30000 (30s) */
  timeout?: number;

  /** Docker network mode. Default: "none" (no network access) */
  networkMode?: "none" | "bridge" | "host";

  /** Mount rootfs as read-only. Default: true */
  readOnlyRootfs?: boolean;

  /** Image to use for Python execution. Default: "aios/python-sandbox:latest" */
  pythonImage?: string;

  /** Image to use for Node.js execution. Default: "aios/node-sandbox:latest" */
  nodeImage?: string;

  /** Working directory inside the container. Default: "/workspace" */
  workingDir?: string;
}

/**
 * Result returned after sandboxed code execution.
 */
export interface ExecutionResult {
  /** Whether the execution completed successfully (exit code 0 and no timeout/OOM) */
  success: boolean;

  /** Captured stdout output */
  stdout: string;

  /** Captured stderr output */
  stderr: string;

  /** Container exit code */
  exitCode: number;

  /** Wall-clock duration of execution in milliseconds */
  durationMs: number;

  /** Whether the execution was killed due to timeout */
  timedOut: boolean;

  /** Whether the container was killed due to out-of-memory */
  oomKilled: boolean;
}

/**
 * Options passed to individual execution calls (override SandboxConfig defaults).
 */
export interface ExecutionOptions {
  memoryLimit?: string;
  cpuQuota?: number;
  timeout?: number;
  networkMode?: "none" | "bridge" | "host";
  readOnlyRootfs?: boolean;
  env?: Record<string, string>;
  files?: Array<{ path: string; content: string }>;
}
