# 📝 PR #10: Langfuse 관측성 시스템

> **Branch**: `feature/langfuse-monitoring`
> **Priority**: P0
> **Duration**: 1주
> **의존성**: 없음

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | console.log → 프로덕션 수준 관측성 |
| **오픈소스** | [Langfuse](https://langfuse.com/) (⭐ 8k+, MIT 라이선스) |
| **영향 패키지** | `packages/monitoring/` (신규) |
| **예상 코드 변화** | 신규 ~400줄 |

---

## 2. 관측성 대시보드

```
Langfuse Dashboard:
├─ 트레이스: Planner → Executor → Critic
├─ 스텝별 시간: 2.3s → 5.1s → 1.8s
├─ 토큰 사용량: 1,234 / 3,456 / 890
├─ 비용: ₩12.5 / ₩34.2 / ₩8.9
├─ 에러율: 0% / 2.3% / 0%
└─ 사용자 피드백: 👍 87%
```

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/monitoring/
├─ src/
│  ├─ langfuse-client.ts      # Langfuse 연결 관리
│  ├─ trace-middleware.ts     # 트레이싱 미들웨어
│  ├─ cost-tracker.ts         # 토큰/비용 추적
│  └─ index.ts
├─ docker-compose.langfuse.yml
├─ package.json
└─ tests/
```

### 3.2 핵심 구현

```typescript
import { Langfuse } from 'langfuse';

export class LangfuseClient {
  private langfuse: Langfuse;

  constructor() {
    this.langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'http://localhost:3000',
    });
  }

  trace(name: string, input: any) {
    return this.langfuse.trace({ name, input });
  }

  async flush() {
    await this.langfuse.flush();
  }
}

export class TraceMiddleware {
  constructor(private client: LangfuseClient) {}

  async wrapStep<T>(traceName: string, stepName: string, fn: () => Promise<T>): Promise<T> {
    const trace = this.client.trace(traceName, {});
    const span = trace.span({ name: stepName });
    const startTime = Date.now();

    try {
      const result = await fn();
      span.end({
        output: result,
        metadata: { durationMs: Date.now() - startTime },
      });
      return result;
    } catch (error) {
      span.end({
        metadata: { error: String(error), durationMs: Date.now() - startTime },
      });
      throw error;
    }
  }
}
```

### 3.3 Docker Compose

```yaml
# docker-compose.langfuse.yml
version: '3.8'
services:
  langfuse:
    image: langfuse/langfuse:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/langfuse
      - NEXTAUTH_SECRET=your-secret
      - NEXTAUTH_URL=http://localhost:3000
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=langfuse
    volumes:
      - langfuse-data:/var/lib/postgresql/data

volumes:
  langfuse-data:
```

---

## 4. 검증 체크리스트

- [ ] Langfuse 셀프호스팅 동작
- [ ] 모든 LLM 호출 트레이싱 동작
- [ ] 토큰 사용량 실시간 표시
- [ ] 비용 대시보드 동작
- [ ] 에러 추적 동작

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
