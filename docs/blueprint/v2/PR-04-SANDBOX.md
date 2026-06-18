# 📝 PR-04: OpenHands 패턴 Docker 격리 샌드박스

> **Branch**: `feature/pr-04-sandbox`
> **Priority**: P1
> **Duration**: 4일
> **의존성**: 없음

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 문자열 매칭 → 실제 코드 실행 환경 (Docker 격리) |
| **오픈소스** | [OpenHands](https://github.com/OpenHands/OpenHands) (⭐ 76k) |
| **영향 패키지** | `packages/sandbox/` (신규) |
| **예상 코드** | 신규 ~800줄 |

---

## 2. 보안 설계

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker 격리 아키텍처                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Host System                                        │   │
│  │  ├─ 메모리: 512MB 제한                              │   │
│  │  ├─ CPU: 50% 제한                                   │   │
│  │  ├─ 네트워크: 차단 (network_mode: none)             │   │
│  │  └─ 파일시스템: 읽기 전용 (read_only: true)         │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Python Sandbox Container                   │   │   │
│  │  │  ├─ python:3.11-slim                        │   │   │
│  │  │  ├─ timeout: 30초                           │   │   │
│  │  │  └─ 결과: stdout/stderr 캡처                │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Node.js Sandbox Container                  │   │   │
│  │  │  ├─ node:22-slim                            │   │   │
│  │  │  ├─ timeout: 30초                           │   │   │
│  │  │  └─ 결과: stdout/stderr 캡처                │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/sandbox/
├─ src/
│  ├─ docker-executor.ts      # Docker 실행 엔진
│  ├─ sandbox-manager.ts      # 컨테이너 생명주기
│  ├─ resource-limiter.ts     # 리소스 제한
│  ├─ result-capturer.ts      # 결과 캡처
│  └─ index.ts
├─ docker/
│  ├─ python-sandbox/
│  │  └─ Dockerfile
│  └─ node-sandbox/
│     └─ Dockerfile
├─ package.json
└─ tests/
   ├─ docker-executor.test.ts
   └─ sandbox-manager.test.ts
```

### 3.2 핵심 구현

#### docker-executor.ts

```typescript
import Docker from 'dockerode';

export interface SandboxConfig {
  memoryLimit: number;     # 바이트 (기본: 512MB)
  cpuQuota: number;        # CPU 할당량 (기본: 50%)
  timeout: number;         # 타임아웃 ms (기본: 30초)
  networkMode: string;     # 네트워크 모드 (기본: none)
  readOnlyRootfs: boolean; # 읽기 전용 (기본: true)
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  oomKilled: boolean;
}

export class DockerExecutor {
  private docker: Docker;
  private config: SandboxConfig;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.docker = new Docker();
    this.config = {
      memoryLimit: config.memoryLimit ?? 512 * 1024 * 1024,
      cpuQuota: config.cpuQuota ?? 50000,  # 50%
      timeout: config.timeout ?? 30000,
      networkMode: config.networkMode ?? 'none',
      readOnlyRootfs: config.readOnlyRootfs ?? true,
    };
  }

  # Python 코드 실행
  async executePython(code: string): Promise<ExecutionResult> {
    return this.execute('python-sandbox:latest', ['python', '-c', code]);
  }

  # Node.js 코드 실행
  async executeNode(code: string): Promise<ExecutionResult> {
    return this.execute('node-sandbox:latest', ['node', '-e', code]);
  }

  # Python 파일 실행
  async executePythonFile(filePath: string, args: string[] = []): Promise<ExecutionResult> {
    return this.execute('python-sandbox:latest', ['python', filePath, ...args]);
  }

  # Node.js 파일 실행
  async executeNodeFile(filePath: string, args: string[] = []): Promise<ExecutionResult> {
    return this.execute('node-sandbox:latest', ['node', filePath, ...args]);
  }

  # 컨테이너 실행 (핵심)
  private async execute(
    image: string,
    cmd: string[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let container: Docker.Container | null = null;

    try {
      # 컨테이너 생성
      container = await this.docker.create({
        Image: image,
        Cmd: cmd,
        HostConfig: {
          Memory: this.config.memoryLimit,
          CpuPeriod: 100000,
          CpuQuota: this.config.cpuQuota,
          NetworkMode: this.config.networkMode,
          ReadonlyRootfs: this.config.readOnlyRootfs,
          SecurityOpt: ['no-new-privileges:true'],
        },
        # 타임아웃 설정
        StopTimeout: Math.ceil(this.config.timeout / 1000),
      });

      # 컨테이너 시작
      await container.start();

      # 결과 대기 (타임아웃 적용)
      const result = await Promise.race([
        this.waitForContainer(container),
        this.timeoutPromise(this.config.timeout, container),
      ]);

      const durationMs = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        timedOut: result.timedOut,
        oomKilled: result.oomKilled,
      };

    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: String(error),
        exitCode: 1,
        durationMs: Date.now() - startTime,
        timedOut: false,
        oomKilled: false,
      };

    } finally {
      # 컨테이너 정리
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          # 정리 실패 무시
        }
      }
    }
  }

  # 컨테이너 결과 대기
  private async waitForContainer(container: Docker.Container): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    oomKilled: boolean;
  }> {
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
    });

    let stdout = '';
    let stderr = '';

    return new Promise((resolve) => {
      stream.on('data', (chunk: Buffer) => {
        const output = chunk.toString();
        # Docker 로그 스트림에서 stdout/stderr 구분
        if (chunk[0] === 1) {
          stdout += output.slice(8);
        } else if (chunk[0] === 2) {
          stderr += output.slice(8);
        } else {
          stdout += output;
        }
      });

      stream.on('end', async () => {
        const inspect = await container.inspect();
        resolve({
          stdout,
          stderr,
          exitCode: inspect.State.ExitCode,
          timedOut: false,
          oomKilled: inspect.State.OOMKilled ?? false,
        });
      });

      stream.on('error', (error) => {
        resolve({
          stdout,
          stderr: stderr + String(error),
          exitCode: 1,
          timedOut: false,
          oomKilled: false,
        });
      });
    });
  }

  # 타임아웃 처리
  private async timeoutPromise(
    timeoutMs: number,
    container: Docker.Container
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    oomKilled: boolean;
  }> {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));

    try {
      await container.kill();
    } catch {
      # 이미 종료된 경우 무시
    }

    return {
      stdout: '',
      stderr: `Timeout: ${timeoutMs}ms 초과`,
      exitCode: 124,  # timeout exit code
      timedOut: true,
      oomKilled: false,
    };
  }

  # Docker 이미지 빌드
  async buildImage(
    name: string,
    dockerfilePath: string
  ): Promise<void> {
    const stream = await this.docker.buildImage({
      context: dockerfilePath,
      src: ['Dockerfile'],
    }, { t: name });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  # 이미지 존재 확인
  async imageExists(name: string): Promise<boolean> {
    try {
      await this.docker.getImage(name);
      return true;
    } catch {
      return false;
    }
  }
}
```

#### sandbox-manager.ts

```typescript
import { DockerExecutor, ExecutionResult } from './docker-executor';

export interface SandboxTask {
  id: string;
  language: 'python' | 'node';
  code: string;
  timeout?: number;
  createdAt: Date;
}

export class SandboxManager {
  private executor: DockerExecutor;
  private taskHistory: Map<string, SandboxTask> = new Map();

  constructor() {
    this.executor = new DockerExecutor();
  }

  # 코드 실행
  async runCode(
    language: 'python' | 'node',
    code: string,
    options: { timeout?: number } = {}
  ): Promise<ExecutionResult> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const task: SandboxTask = {
      id: taskId,
      language,
      code,
      timeout: options.timeout,
      createdAt: new Date(),
    };

    this.taskHistory.set(taskId, task);

    # 실행
    const result = language === 'python'
      ? await this.executor.executePython(code)
      : await this.executor.executeNode(code);

    return result;
  }

  # 파일 실행
  async runFile(
    language: 'python' | 'node',
    filePath: string,
    args: string[] = []
  ): Promise<ExecutionResult> {
    return language === 'python'
      ? await this.executor.executePythonFile(filePath, args)
      : await this.executor.executeNodeFile(filePath, args);
  }

  # 안전한 코드 검증
  validateCode(code: string): {
    valid: boolean;
    warnings: string[];
    blocked: string[];
  } {
    const warnings: string[] = [];
    const blocked: string[] = [];

    # 위험한 패턴 감지
    const dangerousPatterns = [
      { pattern: /import\s+os/, message: 'OS 모듈 사용 감지' },
      { pattern: /import\s+subprocess/, message: 'subprocess 모듈 사용 감지' },
      { pattern: /import\s+shutil/, message: 'shutil 모듈 사용 감지' },
      { pattern: /__import__/, message: '동적 임포트 사용 감지' },
      { pattern: /eval\s*\(/, message: 'eval() 사용 감지' },
      { pattern: /exec\s*\(/, message: 'exec() 사용 감지' },
      { pattern: /open\s*\(/, message: '파일 열기 사용 감지' },
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, message: 'child_process 사용 감지' },
      { pattern: /process\s*\.\s*(exit|kill)/, message: '프로세스 종료 시도 감지' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        warnings.push(message);
      }
    }

    # Docker에서 이미 차단됨 (read_only, no network 등)
    # 따라서 경고만 표시하고 실행은 허용

    return {
      valid: blocked.length === 0,
      warnings,
      blocked,
    };
  }

  # 실행 기록 조회
  getTaskHistory(): SandboxTask[] {
    return Array.from(this.taskHistory.values());
  }

  # Docker 이미지 확인
  async checkDockerImages(): Promise<{
    python: boolean;
    node: boolean;
  }> {
    return {
      python: await this.executor.imageExists('python-sandbox:latest'),
      node: await this.executor.imageExists('node-sandbox:latest'),
    };
  }
}
```

---

## 4. Docker 이미지

```dockerfile
# docker/python-sandbox/Dockerfile
FROM python:3.11-slim

WORKDIR /sandbox

# 필요한 패키지만 설치
RUN pip install --no-cache-dir \
    requests==2.31.0 \
    beautifulsoup4==4.12.0 \
    pandas==2.1.0

# 비 root 사용자
RUN useradd -m -u 1000 sandbox
USER sandbox

# 기본 명령어
CMD ["python"]
```

```dockerfile
# docker/node-sandbox/Dockerfile
FROM node:22-slim

WORKDIR /sandbox

# 필요한 패키지만 설치
RUN npm init -y && \
    npm install --save \
    axios@1.6.0 \
    cheerio@1.0.0-rc.12

# 비 root 사용자
RUN useradd -m -u 1000 sandbox
USER sandbox

# 기본 명령어
CMD ["node"]
```

---

## 5. 테스트 계획

```typescript
// docker-executor.test.ts
describe('DockerExecutor', () => {
  let executor: DockerExecutor;

  beforeEach(() => {
    executor = new DockerExecutor();
  });

  it('should execute Python code', async () => {
    const result = await executor.executePython('print("hello")');
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('hello');
  });

  it('should execute Node.js code', async () => {
    const result = await executor.executeNode('console.log("hello")');
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('hello');
  });

  it('should handle timeout', async () => {
    const executor = new DockerExecutor({ timeout: 1000 });
    const result = await executor.executePython('import time; time.sleep(10)');
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
  }, 10000);

  it('should block network access', async () => {
    const result = await executor.executePython(
      'import urllib.request; urllib.request.urlopen("http://example.com")'
    );
    expect(result.success).toBe(false);
  }, 10000);
});
```

---

## 6. 검증 체크리스트

- [ ] Python 코드 Docker 실행 동작
- [ ] Node.js 코드 Docker 실행 동작
- [ ] 메모리 제한 동작
- [ ] CPU 제한 동작
- [ ] 네트워크 차단 동작
- [ ] 파일시스템 읽기 전용 동작
- [ ] 타임아웃 동작
- [ ] 컨테이너 정리 동작
- [ ] 보안 패턴 검증 동작
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
