# @aios/benchmark

EvoAgentX 기반 벤치마크 프레임워크

## 특징

- **11가지 메트릭**: 성능(4) + 진화(4) + 안정성(3)
- **자동 벤치마크**: 태스크 등록 → 실행 → 리포트 생성
- **리포트 생성**: JSON/마크다운 형식 지원

## 설치

```bash
pnpm add @aios/benchmark
```

## 사용법

```typescript
import { BenchmarkRunner, MetricsCollector, ReportGenerator } from '@aios/benchmark';

// 러너 생성
const runner = new BenchmarkRunner();

// 태스크 등록
runner.registerTask({
  id: 'test-1',
  name: '검색 정확도 테스트',
  category: 'search',
  input: { query: 'Sangfor EPP 정책' },
  timeout: 5000,
  tags: ['search', 'accuracy'],
});

// 실행
const results = await runner.run(async (input) => {
  // 실제 핸들러
  return { result: 'success' };
});

// 리포트 생성
const generator = new ReportGenerator();
const report = generator.generateReport(results);
console.log(report.summary);
```

## 메트릭

### 성능 메트릭 (PerformanceMetrics)
- accuracy: 정확도
- precision: 정밀도
- recall: 재현율
- f1Score: F1 점수
- latencyMs: 지연 시간
- throughput: 처리량

### 진화 메트릭 (EvolutionMetrics)
- reward: 보상
- improvement: 개선도
- iterations: 이터레이션 수
- convergenceRate: 수렴률

### 안정성 메트릭 (StabilityMetrics)
- consistency: 일관성
- errorRate: 에러율
- timeoutRate: 타임아웃률
- oomRate: OOM 비율

## 테스트

```bash
pnpm test
```
