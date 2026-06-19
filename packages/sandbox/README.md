# @aios/sandbox

Docker-isolated code execution sandbox for the AIOS platform, following the OpenHands pattern.

## Overview

This package provides security-hardened, Docker-based code execution with the following guarantees:

- **Network isolation**: Containers run with `network_mode: none` by default
- **Read-only rootfs**: Filesystem is immutable; only `/tmp` is writable (tmpfs, 64MB)
- **Memory limits**: Containers are memory-capped via cgroups (default: 256MB)
- **CPU quotas**: CPU usage is limited (default: 50% of one core)
- **No privilege escalation**: `no-new-privileges` security option is enforced
- **Minimal capabilities**: All Linux capabilities are dropped except SETUID/SETGID
- **Non-root execution**: Code runs as a non-root `sandbox` user inside the container
- **Timeout enforcement**: Long-running code is killed after a configurable timeout (default: 30s)
- **Automatic cleanup**: Containers are always removed after execution, even on error

## Installation

```bash
npm install @aios/sandbox
```

## Usage

### Basic: Run Python Code

```typescript
import { SandboxManager } from "@aios/sandbox";

const manager = new SandboxManager();
const result = await manager.runCode('print("Hello, World!")', "python");

console.log(result.stdout); // "Hello, World!\n"
console.log(result.success); // true
```

### Run Node.js Code

```typescript
const result = await manager.runCode('console.log("Hello from Node!")', "node");
console.log(result.stdout); // "Hello from Node!\n"
```

### Run a File

```typescript
import { readFileSync } from "node:fs";

const fileContent = readFileSync("script.py", "utf-8");
const result = await manager.runFile("script.py", fileContent);
```

### Custom Configuration

```typescript
import { DockerExecutor } from "@aios/sandbox";

const executor = new DockerExecutor({
  memoryLimit: "512m",    // 512 MB memory limit
  cpuQuota: 0.75,          // 75% of one CPU core
  timeout: 10_000,         // 10 second timeout
  networkMode: "none",     // No network access
  readOnlyRootfs: true,    // Immutable root filesystem
});

const result = await executor.executePython("import sys; print(sys.version)");
```

### Code Validation

```typescript
const manager = new SandboxManager();
const validation = manager.validateCode("sudo rm -rf /");

if (!validation.safe) {
  console.error("Blocked:", validation.issues);
  // ["sudo usage", "Recursive root deletion"]
}
```

## Building Docker Images

Before using the sandbox, build the Docker images:

```bash
# Build Python sandbox image
docker build -t aios/python-sandbox:latest -f docker/python-sandbox/Dockerfile .

# Build Node.js sandbox image
docker build -t aios/node-sandbox:latest -f docker/node-sandbox/Dockerfile .
```

## API

### `SandboxManager`

| Method | Description |
|--------|-------------|
| `runCode(code, language, options?)` | Execute a code string in a sandbox |
| `runFile(fileName, content, options?)` | Execute a file in a sandbox |
| `runLocalFile(filePath, options?)` | Execute a local file in a sandbox |
| `validateCode(code)` | Check code for dangerous patterns |

### `DockerExecutor`

| Method | Description |
|--------|-------------|
| `executePython(code, options?)` | Execute Python code in a container |
| `executeNode(code, options?)` | Execute Node.js code in a container |
| `executePythonFile(name, content, options?)` | Execute a Python file in a container |
| `executeNodeFile(name, content, options?)` | Execute a Node.js file in a container |

### `SandboxConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memoryLimit` | `string` | `"256m"` | Container memory limit |
| `cpuQuota` | `number` | `0.5` | CPU quota (0-1, fraction of one core) |
| `timeout` | `number` | `30000` | Execution timeout (ms) |
| `networkMode` | `string` | `"none"` | Docker network mode |
| `readOnlyRootfs` | `boolean` | `true` | Read-only root filesystem |

### `ExecutionResult`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether execution succeeded |
| `stdout` | `string` | Captured stdout |
| `stderr` | `string` | Captured stderr |
| `exitCode` | `number` | Container exit code |
| `durationMs` | `number` | Execution duration (ms) |
| `timedOut` | `boolean` | Whether execution was killed by timeout |
| `oomKilled` | `boolean` | Whether container was OOM-killed |

## Security Model

This package implements defence-in-depth security:

1. **Container isolation** (primary): Docker containers provide namespace and cgroup isolation
2. **Network disabled**: No outbound network access prevents data exfiltration
3. **Read-only rootfs**: Prevents filesystem tampering
4. **Memory/CPU limits**: Prevents resource exhaustion attacks
5. **Non-root user**: Reduces privilege even if container escape occurs
6. **Capability dropping**: Minimal Linux capabilities
7. **no-new-privileges**: Prevents privilege escalation via setuid binaries
8. **Code validation** (supplementary): Pattern-based detection of dangerous code before execution

The code validation layer (in `SandboxManager.validateCode`) is a supplementary defence. It catches obvious dangerous patterns but is **not** a security boundary — the container provides the actual isolation.
