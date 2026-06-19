import Docker from "dockerode";
import type { SandboxConfig, ExecutionOptions, ExecutionResult } from "./types.js";

const DEFAULT_CONFIG: Required<SandboxConfig> = {
  memoryLimit: "256m",
  cpuQuota: 0.5,
  timeout: 30_000,
  networkMode: "none",
  readOnlyRootfs: true,
  pythonImage: "aios/python-sandbox:latest",
  nodeImage: "aios/node-sandbox:latest",
  workingDir: "/workspace",
};

/**
 * DockerExecutor provides low-level, security-hardened container execution.
 *
 * Each invocation creates a fresh container with:
 * - `network_mode: none` (no network access)
 * - Read-only rootfs with a tmpfs `/tmp` for scratch writes
 * - Memory and CPU limits enforced via cgroups
 * - `no-new-privileges` security option
 * - Timeout-based kill with proper cleanup in a finally block
 */
export class DockerExecutor {
  private docker: Docker;
  private config: Required<SandboxConfig>;

  constructor(config?: SandboxConfig) {
    this.docker = new Docker();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a Python code string inside a sandbox container.
   */
  async executePython(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    return this.execute({
      image: this.config.pythonImage,
      command: ["python3", "-c", code],
      options,
    });
  }

  /**
   * Execute a Node.js code string inside a sandbox container.
   */
  async executeNode(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    return this.execute({
      image: this.config.nodeImage,
      command: ["node", "-e", code],
      options,
    });
  }

  /**
   * Execute a Python file inside a sandbox container.
   * The file is written into the container's working directory before execution.
   */
  async executePythonFile(
    fileName: string,
    fileContent: string,
    options?: ExecutionOptions,
  ): Promise<ExecutionResult> {
    return this.execute({
      image: this.config.pythonImage,
      command: ["python3", `/workspace/${fileName}`],
      options: {
        ...options,
        files: [...(options?.files ?? []), { path: `/workspace/${fileName}`, content: fileContent }],
      },
    });
  }

  /**
   * Execute a Node.js file inside a sandbox container.
   * The file is written into the container's working directory before execution.
   */
  async executeNodeFile(
    fileName: string,
    fileContent: string,
    options?: ExecutionOptions,
  ): Promise<ExecutionResult> {
    return this.execute({
      image: this.config.nodeImage,
      command: ["node", `/workspace/${fileName}`],
      options: {
        ...options,
        files: [...(options?.files ?? []), { path: `/workspace/${fileName}`, content: fileContent }],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private core execution engine
  // ---------------------------------------------------------------------------

  private async execute(params: {
    image: string;
    command: string[];
    options?: ExecutionOptions;
  }): Promise<ExecutionResult> {
    const { image, command, options } = params;
    const timeout = options?.timeout ?? this.config.timeout;
    const memoryLimit = options?.memoryLimit ?? this.config.memoryLimit;
    const cpuQuota = options?.cpuQuota ?? this.config.cpuQuota;
    const networkMode = options?.networkMode ?? this.config.networkMode;
    const readOnlyRootfs = options?.readOnlyRootfs ?? this.config.readOnlyRootfs;
    const workingDir = this.config.workingDir;

    const startTime = Date.now();
    let container: Docker.Container | null = null;
    let timedOut = false;
    let oomKilled = false;
    let exitCode = 0;

    try {
      // Build container create options with security hardening
      const hostConfig: Docker.HostConfig = {
        // Memory limit via cgroups
        Memory: this.parseMemoryLimit(memoryLimit),
        // CPU quota: 100000 µs period, quota = cpuQuota * 100000
        CpuPeriod: 100_000,
        CpuQuota: Math.round(cpuQuota * 100_000),
        // Network isolation
        NetworkMode: networkMode,
        // Read-only root filesystem
        ReadonlyRootfs: readOnlyRootfs,
        // Tmpfs for /tmp so programs can still write temp files
        Tmpfs: readOnlyRootfs ? { "/tmp": "rw,noexec,nosuid,size=64m" } : undefined,
        // Security: no-new-privileges prevents setuid escalation
        SecurityOpt: ["no-new-privileges"],
        // Drop all capabilities, add back only what's needed
        CapDrop: ["ALL"],
        CapAdd: ["SETUID", "SETGID"],
      };

      // Create the container
      container = await this.docker.createContainer({
        Image: image,
        Cmd: command,
        WorkingDir: workingDir,
        Env: options?.env
          ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
          : undefined,
        HostConfig: hostConfig,
        // Detach so we can wait with a timeout
        AttachStdout: true,
        AttachStderr: true,
      });

      // Start the container
      await container.start();

      // Wait for completion with timeout
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        const timer = setTimeout(() => {
          timedOut = true;
          resolve("timeout");
        }, timeout);
        // Allow the timer to not keep the process alive
        if (timer.unref) timer.unref();
      });

      const result = await Promise.race([waitPromise, timeoutPromise]);

      if (result === "timeout") {
        // Graceful stop attempt, then force kill
        try {
          await container.stop({ t: 5 }); // SIGTERM for 5s
        } catch {
          // Container may have already exited
        }
        try {
          await container.kill();
        } catch {
          // Already dead
        }
        exitCode = -1;
      } else {
        // Container finished naturally — inspect for OOM
        const inspectData = await container.inspect();
        oomKilled = inspectData.State?.OOMKilled ?? false;
        exitCode = inspectData.State?.ExitCode ?? 1;
      }

      // Collect logs
      let stdout = "";
      let stderr = "";
      try {
        const logStream = await container.logs({ follow: true, stdout: true, stderr: true });
        const logs = await this.streamToString(logStream);
        // Docker multiplexed streams interleave stdout (stream 1) and stderr (stream 2)
        // For simplicity, treat everything as combined output; callers can split if needed
        stdout = logs;
      } catch {
        // Logs may not be available if container was force-killed
      }

      return {
        success: exitCode === 0 && !timedOut && !oomKilled,
        stdout,
        stderr,
        exitCode,
        durationMs: Date.now() - startTime,
        timedOut,
        oomKilled,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        durationMs: Date.now() - startTime,
        timedOut,
        oomKilled,
      };
    } finally {
      // Always clean up the container
      if (container) {
        try {
          await container.remove({ force: true, v: true });
        } catch {
          // Best-effort removal
        }
      }
    }
  }

  /**
   * Parse a human-readable memory string (e.g., "256m", "1g") into bytes.
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+(?:\.\d+)?)\s*(b|k|m|g|t)?$/i);
    if (!match) {
      // Default to 256 MB
      return 256 * 1024 * 1024;
    }
    const value = parseFloat(match[1]);
    const unit = (match[2] ?? "b").toLowerCase();
    const multipliers: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      t: 1024 * 1024 * 1024 * 1024,
    };
    return Math.round(value * (multipliers[unit] ?? 1));
  }

  /**
   * Collect a Docker log stream into a string.
   */
  private streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", reject);
    });
  }
}
