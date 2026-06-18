# 📝 PR #7: OpenHands 패턴 Docker 격리 샌드박스

> **Branch**: `feature/openshands-sandbox`
> **Priority**: P1
> **Duration**: 1주
> **의존성**: 없음

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 문자열 매칭 → 실제 코드 실행 환경 (Docker 격리) |
| **오픈소스** | [OpenHands](https://github.com/OpenHands/OpenHands) (⭐ 76k) |
| **영향 패키지** | `packages/sandbox/` (신규) |
| **예상 코드 변화** | 신규 ~500줄 |

---

## 2. 구현 지침

### 2.1 파일 구조

```
packages/sandbox/
├─ src/
│  ├─ docker-executor.ts      # Docker 실행 엔진
│  ├─ sandbox-manager.ts      # 컨테이너 생명주기
│  ├─ resource-limiter.ts     # 리소스 제한
│  ├─ result-capturer.ts      # 결과 캡처
│  └─ index.ts
├─ docker/
│  ├─ python-sandbox/Dockerfile
│  └─ node-sandbox/Dockerfile
├─ package.json
└─ tests/
```

### 2.2 보안 설정

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
network_mode: 'none'
read_only: true
security_opt:
  - no-new-privileges:true
```

### 2.3 핵심 구현

```typescript
import Docker from 'dockerode';

export class DockerExecutor {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async executeCode(code: string, language: 'python' | 'node'): Promise<SandboxResult> {
    const image = language === 'python' ? 'python-sandbox:latest' : 'node-sandbox:latest';
    const cmd = language === 'python'
      ? ['python', '-c', code]
      : ['node', '-e', code];

    const container = await this.docker.create({
      Image: image,
      Cmd: cmd,
      HostConfig: {
        Memory: 512 * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        NetworkMode: 'none',
        ReadonlyRootfs: true,
      },
    });

    const startTime = Date.now();
    await container.start();

    const result = await container.logs({ stdout: true, stderr: true });
    const exitCode = (await container.wait()).StatusCode;
    const durationMs = Date.now() - startTime;

    await container.remove({ force: true });

    return {
      success: exitCode === 0,
      output: result.toString(),
      exitCode,
      durationMs,
    };
  }
}
```

---

## 3. 검증 체크리스트

- [ ] Python 코드 Docker 실행 동작
- [ ] Node.js 코드 Docker 실행 동작
- [ ] 메모리/CPU 제한 동작
- [ ] 네트워크 차단 동작
- [ ] 타임아웃 동작
- [ ] 컨테이너 정리 동작

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
