# @aios/monitoring

Langfuse 기반 LLM 관측성 시스템

## 특징

- **Langfuse 연동**: 프로덕션 수준 트레이싱
- **비용 추적**: 모델별 토큰/비용 모니터링
- **알림 시스템**: 에러/지연/비용 임계값 알림
- **폴백 모드**: Langfuse 연결 실패 시 Mock 동작

## 설치

```bash
pnpm add @aios/monitoring
```

## 사용법

```typescript
import { LangfuseClient, TraceMiddleware, CostTracker } from '@aios/monitoring';

// 클라이언트 초기화
const client = new LangfuseClient({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_URL ?? 'http://localhost:3000',
});

// 미들웨어 생성
const middleware = new TraceMiddleware(client);

// 워크플로우 트레이싱
const result = await middleware.traceWorkflow('my-workflow', input, async (ctx) => {
  return middleware.traceStep(ctx, 'step-1', input, async () => {
    // 실제 작업
    return { output: 'result' };
  });
});

// 비용 추적
const tracker = new CostTracker();
tracker.recordUsage({ model: 'claude-sonnet-4', promptTokens: 1000, completionTokens: 500 });
```

## Docker

```bash
cd packages/monitoring/docker
docker compose -f docker-compose.langfuse.yml up -d
```

## 테스트

```bash
pnpm test
```
