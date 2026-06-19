# 📝 PR-01: Langfuse 관측성 시스템

> **Branch**: `feature/pr-01-langfuse`
> **Priority**: P0
> **Duration**: 3일
> **의존성**: 없음 (첫 번째 PR)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | console.log → 프로덕션 수준 관측성 |
| **오픈소스** | [Langfuse](https://langfuse.com/) (⭐ 8k+, MIT) |
| **영향 패키지** | `packages/monitoring/` (신규) |
| **예상 코드** | 신규 ~500줄 |

---

## 2. 기술 설계

### 2.1 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Langfuse 관측성 아키텍처                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │ Orchestrator │────▶│   Langfuse   │────▶│  Dashboard   ││
│  │              │     │   Client     │     │              ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │    Trace     │     │     Cost     │     │    Alert     ││
│  │   (단계별)   │     │   (토큰/시간) │     │  (에러 알림)  ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 트레이싱 대상

| 구간 | 메트릭 | 설명 |
|------|--------|------|
| **Planner** | 토큰, 시간 | 계획 수립 단계 |
| **Executor** | 토큰, 시간, 도구 호출 | 실행 단계 |
| **Critic** | 토큰, 시간, 판정 | 리뷰 단계 |
| **MCP Calls** | 시간, 성공/실패 | 외부 도구 호출 |
| **LLM Calls** | 토큰, 비용, 시간 | 모델 호출 |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/monitoring/
├─ src/
│  ├─ langfuse-client.ts      # Langfuse 연결 관리
│  ├─ trace-middleware.ts     # 트레이싱 미들웨어
│  ├─ cost-tracker.ts         # 토큰/비용 추적
│  ├─ alert-manager.ts        # 에러 알림 관리
│  └─ index.ts
├─ docker-compose.langfuse.yml # Docker 설정
├─ .env.example                # 환경 변수 예시
├─ package.json
└─ tests/
   ├─ langfuse-client.test.ts
   ├─ trace-middleware.test.ts
   └─ cost-tracker.test.ts
```

### 3.2 핵심 구현

#### langfuse-client.ts

```typescript
import { Langfuse } from 'langfuse';

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  flushAt?: number;        # 몇 개 모아서 보낼지 (기본 10)
  flushInterval?: number;  #_FLUSH 주기 ms (기본 1000)
}

export class LangfuseClient {
  private langfuse: Langfuse;
  private isHealthy: boolean = false;

  constructor(config: LangfuseConfig) {
    this.langfuse = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      flushAt: config.flushAt ?? 10,
      flushInterval: config.flushInterval ?? 1000,
    });

    # 헬스 체크
    this.healthCheck();
  }

  private async healthCheck() {
    try {
      await fetch(`${this.langfuse.baseUrl}/api/public/health`);
      this.isHealthy = true;
      console.log('[Langfuse] 연결 성공');
    } catch (error) {
      this.isHealthy = false;
      console.warn('[Langfuse] 연결 실패, 폴백 모드');
    }
  }

  # 트레이스 생성
  createTrace(params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
    userId?: string;
    sessionId?: string;
  }) {
    if (!this.isHealthy) return this.createMockTrace();

    return this.langfuse.trace({
      name: params.name,
      input: params.input,
      metadata: params.metadata,
      userId: params.userId,
      sessionId: params.sessionId,
    });
  }

  # 스팬 생성
  createSpan(trace: any, params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }) {
    if (!this.isHealthy) return this.createMockSpan();

    return trace.span({
      name: params.name,
      input: params.input,
      metadata: params.metadata,
    });
  }

  # 이벤트 생성
  createEvent(trace: any, params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }) {
    if (!this.isHealthy) return;

    trace.event({
      name: params.name,
      input: params.input,
      metadata: params.metadata,
    });
  }

  # 생성자 (폴백)
  private createMockTrace() {
    return {
      id: `mock-${Date.now()}`,
      span: () => this.createMockSpan(),
      event: () => {},
      update: () => {},
      end: () => {},
    };
  }

  private createMockSpan() {
    return {
      id: `mock-span-${Date.now()}`,
      end: () => {},
      update: () => {},
    };
  }

  # 플러시
  async flush() {
    if (this.isHealthy) {
      await this.langfuse.flush();
    }
  }

  # 연결 상태
  get connected() {
    return this.isHealthy;
  }
}
```

#### trace-middleware.ts

```typescript
import { LangfuseClient } from './langfuse-client';

export interface TraceContext {
  trace: any;
  span: any;
}

export class TraceMiddleware {
  constructor(private client: LangfuseClient) {}

  # 워크플로우 전체 트레이싱
  async traceWorkflow<T>(
    name: string,
    input: any,
    fn: (ctx: TraceContext) => Promise<T>
  ): Promise<T> {
    const trace = this.client.createTrace({
      name,
      input,
      metadata: {
        version: process.env.APP_VERSION ?? 'unknown',
        environment: process.env.NODE_ENV ?? 'development',
      },
    });

    const ctx: TraceContext = {
      trace,
      span: this.client.createSpan(trace, { name: `${name}-root` }),
    };

    try {
      const result = await fn(ctx);
      ctx.span.end({ output: result });
      return result;
    } catch (error) {
      ctx.span.end({
        output: { error: String(error) },
        metadata: { level: 'ERROR' },
      });
      throw error;
    } finally {
      await this.client.flush();
    }
  }

  # 개별 스텝 트레이싱
  async traceStep<T>(
    ctx: TraceContext,
    stepName: string,
    input: any,
    fn: () => Promise<T>
  ): Promise<T> {
    const childSpan = this.client.createSpan(ctx.trace, {
      name: stepName,
      input,
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      childSpan.end({
        output: result,
        metadata: { durationMs: Date.now() - startTime },
      });
      return result;
    } catch (error) {
      childSpan.end({
        output: { error: String(error) },
        metadata: {
          durationMs: Date.now() - startTime,
          level: 'ERROR',
        },
      });
      throw error;
    }
  }

  # LLM 호출 트레이싱
  async traceLLMCall<T>(
    ctx: TraceContext,
    params: {
      model: string;
      messages: any[];
      temperature?: number;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.client.createSpan(ctx.trace, {
      name: `llm-${params.model}`,
      input: {
        model: params.model,
        messageCount: params.messages.length,
        temperature: params.temperature,
      },
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      span.end({
        output: result,
        metadata: {
          durationMs: Date.now() - startTime,
          model: params.model,
        },
      });
      return result;
    } catch (error) {
      span.end({
        output: { error: String(error) },
        metadata: { durationMs: Date.now() - startTime },
      });
      throw error;
    }
  }

  # MCP 도구 호출 트레이싱
  async traceToolCall<T>(
    ctx: TraceContext,
    params: {
      toolName: string;
      arguments: any;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.client.createSpan(ctx.trace, {
      name: `tool-${params.toolName}`,
      input: params.arguments,
    });

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
        output: { error: String(error) },
        metadata: { durationMs: Date.now() - startTime },
      });
      throw error;
    }
  }
}
```

#### cost-tracker.ts

```typescript
import { LangfuseClient } from './langfuse-client';

export interface TokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  costKRW: number;
  timestamp: Date;
}

export class CostTracker {
  private usageHistory: TokenUsage[] = [];

  # 모델별 비용 단가 (USD per 1M tokens)
  private modelPricing: Record<string, { input: number; output: number }> = {
    'qwen3.5-9b': { input: 0.0, output: 0.0 },        # 로컬 (무료)
    'gemma-4-26b-a4b': { input: 0.0, output: 0.0 },    # 로컬 (무료)
    'claude-sonnet-4': { input: 3.0, output: 15.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  };

  # 환율 (USD → KRW)
  private exchangeRate = 1350;

  # 토큰 사용량 기록
  recordUsage(params: {
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): TokenUsage {
    const pricing = this.modelPricing[params.model] ?? { input: 0, output: 0 };

    const costUSD =
      (params.promptTokens / 1_000_000) * pricing.input +
      (params.completionTokens / 1_000_000) * pricing.output;

    const usage: TokenUsage = {
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      costUSD,
      costKRW: costUSD * this.exchangeRate,
      timestamp: new Date(),
    };

    this.usageHistory.push(usage);
    return usage;
  }

  # 세션별 비용 집계
  getSessionCost(sessionId: string): {
    totalTokens: number;
    totalCostUSD: number;
    totalCostKRW: number;
    byModel: Record<string, { tokens: number; cost: number }>;
  } {
    const sessionUsage = this.usageHistory.filter(
      u => u.timestamp.getTime() > Date.now() - 3600_000  # 최근 1시간
    );

    const byModel: Record<string, { tokens: number; cost: number }> = {};

    for (const usage of sessionUsage) {
      if (!byModel[usage.model]) {
        byModel[usage.model] = { tokens: 0, cost: 0 };
      }
      byModel[usage.model].tokens += usage.totalTokens;
      byModel[usage.model].cost += usage.costKRW;
    }

    return {
      totalTokens: sessionUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCostUSD: sessionUsage.reduce((sum, u) => sum + u.costUSD, 0),
      totalCostKRW: sessionUsage.reduce((sum, u) => sum + u.costKRW, 0),
      byModel,
    };
  }

  # 일일 비용 리포트
  getDailyReport(): {
    date: string;
    totalTokens: number;
    totalCostKRW: number;
    topModels: Array<{ model: string; tokens: number; cost: number }>;
  } {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = this.usageHistory.filter(
      u => u.timestamp.toISOString().startsWith(today)
    );

    const modelMap: Record<string, { tokens: number; cost: number }> = {};

    for (const usage of todayUsage) {
      if (!modelMap[usage.model]) {
        modelMap[usage.model] = { tokens: 0, cost: 0 };
      }
      modelMap[usage.model].tokens += usage.totalTokens;
      modelMap[usage.model].cost += usage.costKRW;
    }

    const topModels = Object.entries(modelMap)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    return {
      date: today,
      totalTokens: todayUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCostKRW: todayUsage.reduce((sum, u) => sum + u.costKRW, 0),
      topModels,
    };
  }
}
```

---

## 4. Docker Compose

```yaml
# docker-compose.langfuse.yml
version: '3.8'

services:
  langfuse:
    image: langfuse/langfuse:latest
    container_name: aios-langfuse
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@langfuse-db:5432/langfuse
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://localhost:3000
      - SALT=${SALT}
    depends_on:
      - langfuse-db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/public/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  langfuse-db:
    image: postgres:16-alpine
    container_name: aios-langfuse-db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=langfuse
    volumes:
      - langfuse-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  langfuse-data:
    driver: local
```

---

## 5. 환경 변수

```bash
# .env.example
# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=http://localhost:3000

# PostgreSQL
POSTGRES_PASSWORD=your-secure-password

# NextAuth
NEXTAUTH_SECRET=your-random-secret
SALT=your-random-salt
```

---

## 6. 테스트 계획

### 6.1 단위 테스트

```typescript
// langfuse-client.test.ts
describe('LangfuseClient', () => {
  it('should create trace', () => {
    const client = new LangfuseClient(mockConfig);
    const trace = client.createTrace({ name: 'test' });
    expect(trace).toBeDefined();
  });

  it('should fallback when unhealthy', () => {
    const client = new LangfuseClient({ ...mockConfig, baseUrl: 'http://invalid' });
    const trace = client.createTrace({ name: 'test' });
    expect(trace.id).toContain('mock');
  });
});

// trace-middleware.test.ts
describe('TraceMiddleware', () => {
  it('should trace workflow', async () => {
    const middleware = new TraceMiddleware(mockClient);
    const result = await middleware.traceWorkflow('test', {}, async (ctx) => {
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('should trace LLM call', async () => {
    const middleware = new TraceMiddleware(mockClient);
    const result = await middleware.traceLLMCall(
      mockCtx,
      { model: 'test', messages: [] },
      async () => 'response'
    );
    expect(result).toBe('response');
  });
});
```

---

## 7. 검증 체크리스트

- [ ] Langfuse Docker 배포 성공
- [ ] 대시보드 접속 가능
- [ ] 모든 LLM 호출 트레이싱
- [ ] 토큰 사용량 실시간 표시
- [ ] 비용 대시보드 동작
- [ ] 에러 추적 동작
- [ ] 테스트 커버리지 80%+
- [ ] 기존 기능 회귀 없음

---

## 8. 병합 조건

1. 모든 테스트 통과
2. Langfuse Docker 빌드 성공
3. 대시보드에서 트레이싱 확인
4. 기존 기능 회귀 없음
5. 코드 리뷰 승인

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
