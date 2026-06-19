import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { DockerExecutor } from "./docker-executor.js";
import type { SandboxConfig, ExecutionOptions, ExecutionResult } from "./types.js";

/**
 * Dangerous code patterns that should be blocked before container execution.
 * These are defence-in-depth checks; the container itself provides the primary isolation.
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // System / host escapes
  { pattern: /\bdocker\b.*\bexec\b/i, description: "Docker exec escape attempt" },
  { pattern: /\bcontainerd\b/i, description: "containerd reference" },
  { pattern: /\bhost\.docker\.internal\b/i, description: "Docker host internal access" },
  { pattern: /\b\/proc\/\b/i, description: "Host /proc access attempt" },
  { pattern: /\b\/sys\/\b/i, description: "Host /sys access attempt" },
  { pattern: /\bmount\b.*\b\/\b/i, description: "Filesystem mount attempt" },

  // Privilege escalation
  { pattern: /\bsudo\b/i, description: "sudo usage" },
  { pattern: /\bchmod\s+[ugo]*\+s\b/i, description: "setuid/setgid bit change" },
  { pattern: /\bchown\b/i, description: "Ownership change attempt" },
  { pattern: /\bcapsh\b/i, description: "Capability shell attempt" },

  // Network exfiltration / C2 (even though network is disabled, belt-and-suspenders)
  { pattern: /\bcurl\b.*\bhttps?:\/\//i, description: "Outbound HTTP request via curl" },
  { pattern: /\bwget\b.*\bhttps?:\/\//i, description: "Outbound HTTP request via wget" },
  { pattern: /\brequests\b.*\bget\b.*\bhttp/i, description: "Python HTTP request" },
  { pattern: /\bfetch\s*\(\s*['"]https?:\/\//i, description: "JavaScript fetch call" },
  { pattern: /\bhttp\.request\b/i, description: "Node.js HTTP request" },

  // Dangerous filesystem operations
  { pattern: /(?<!\w)rm\s+-rf\s+\//i, description: "Recursive root deletion" },
  { pattern: /\bmkfs\b/i, description: "Filesystem format attempt" },
  { pattern: /\bdd\s+.*of=\/dev\//i, description: "Direct disk write attempt" },
  // Fork bombs
  { pattern: /(?<!\w):\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/, description: "Fork bomb" },
];

/**
 * SandboxManager provides a high-level API for sandboxed code execution.
 *
 * It wraps DockerExecutor with:
 * - Code validation (dangerous pattern detection)
 * - Convenience methods for common execution patterns
 * - Consistent error handling
 */
export class SandboxManager {
  private executor: DockerExecutor;

  constructor(config?: SandboxConfig) {
    this.executor = new DockerExecutor(config);
  }

  /**
   * Validate code for dangerous patterns before execution.
   * Returns an object with the validation result and any detected issues.
   */
  validateCode(code: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const { pattern, description } of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        issues.push(description);
      }
    }

    // Basic sanity checks
    if (code.length === 0) {
      issues.push("Empty code block");
    }
    if (code.length > 1_000_000) {
      issues.push("Code exceeds maximum length (1MB)");
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  /**
   * Detect the language from a filename extension.
   */
  private detectLanguage(fileName: string): "python" | "node" {
    const ext = extname(fileName).toLowerCase();
    if (ext === ".py") return "python";
    if ([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"].includes(ext)) return "node";
    // Default to Python for unknown extensions
    return "python";
  }

  /**
   * Run code in a sandbox container.
   *
   * @param code - The source code to execute
   * @param language - The programming language ("python" or "node")
   * @param options - Optional execution overrides
   * @returns ExecutionResult with stdout, stderr, exit code, etc.
   */
  async runCode(
    code: string,
    language: "python" | "node",
    options?: ExecutionOptions & { skipValidation?: boolean },
  ): Promise<ExecutionResult> {
    // Validate unless explicitly skipped
    if (!options?.skipValidation) {
      const validation = this.validateCode(code);
      if (!validation.safe) {
        return {
          success: false,
          stdout: "",
          stderr: `Code validation failed:\n${validation.issues.map((i) => `  - ${i}`).join("\n")}`,
          exitCode: -1,
          durationMs: 0,
          timedOut: false,
          oomKilled: false,
        };
      }
    }

    if (language === "python") {
      return this.executor.executePython(code, options);
    } else {
      return this.executor.executeNode(code, options);
    }
  }

  /**
   * Run a file in a sandbox container.
   *
   * @param fileName - The filename (used for language detection and in-container path)
   * @param fileContent - The file content as a string
   * @param options - Optional execution overrides
   * @returns ExecutionResult
   */
  async runFile(
    fileName: string,
    fileContent: string,
    options?: ExecutionOptions & { skipValidation?: boolean },
  ): Promise<ExecutionResult> {
    // Validate unless explicitly skipped
    if (!options?.skipValidation) {
      const validation = this.validateCode(fileContent);
      if (!validation.safe) {
        return {
          success: false,
          stdout: "",
          stderr: `Code validation failed:\n${validation.issues.map((i) => `  - ${i}`).join("\n")}`,
          exitCode: -1,
          durationMs: 0,
          timedOut: false,
          oomKilled: false,
        };
      }
    }

    const language = this.detectLanguage(fileName);

    if (language === "python") {
      return this.executor.executePythonFile(fileName, fileContent, options);
    } else {
      return this.executor.executeNodeFile(fileName, fileContent, options);
    }
  }

  /**
   * Convenience: run a file from the local filesystem.
   *
   * @param filePath - Absolute path to the file on the host
   * @param options - Optional execution overrides
   * @returns ExecutionResult
   */
  async runLocalFile(
    filePath: string,
    options?: ExecutionOptions & { skipValidation?: boolean },
  ): Promise<ExecutionResult> {
    const fileContent = readFileSync(filePath, "utf-8");
    const fileName = filePath.split("/").pop() ?? "unknown";
    return this.runFile(fileName, fileContent, options);
  }
}
