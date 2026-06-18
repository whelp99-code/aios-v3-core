# 📝 PR #1: LightRAG 기반 GraphRAG 재구현

> **Branch**: `feature/lightrag-integration`
> **Priority**: P0
> **Duration**: 1주
> **의존성**: PR-10 (Langfuse)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 36줄 단순 키워드 검색 → LightRAG 기반 프로덕션 수준 그래프 검색 |
| **오픈소스** | [LightRAG](https://github.com/HKUDS/LightRAG) (⭐ 36.3k, EMNLP 2025) |
| **영향 패키지** | `packages/knowledge-graph/` |
| **예상 코드 변화** | 584줄 → ~1,200줄 |

---

## 2. 기술 설계

### 2.1 아키텍처

```
현재:
  TypeScript → 메모리 기반 그래프 → 단순 필터링

목표:
  TypeScript 어댑터 → HTTP → LightRAG Python 서버
                                    ↓
                              LM Studio (임베딩)
                                    ↓
                              그래프 저장소 (Neo4j/PostgreSQL)
```

### 2.2 왜 TypeScript + Python 분리인가?

- LightRAG는 Python 라이브러리 (TypeScript 네이티브 없음)
- Python 서버로 분리하고, TypeScript에서 HTTP로 호출
- LM Studio의 OpenAI 호환 API로 임베딩 전송
- Docker Compose로 오케스트레이션

### 2.3 검색 모드

| 모드 | 설명 | 사용 시나리오 |
|------|------|-------------|
| `local` | 특정 엔티티와 직접 속성에 초점 | Sangfor 제품 특정 설정 검색 |
| `global` | 거시적 주제, 요약, 문서 간 관계 | 정책 전체 흐름 검색 |
| `hybrid` | local + global 병합 | 범용 검색 |
| `mix` | 모든 모드 병합 (기본값) | 가장 포괄적인 결과 |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/knowledge-graph/
├─ src/
│  ├─ lightrag-adapter.ts         # ★ 신규: LightRAG TypeScript 어댑터
│  ├─ embedding-client.ts         # ★ 신규: LM Studio 임베딩 클라이언트
│  ├─ query-engine.ts             # ★ 신규: 검색 엔진 (4가지 모드)
│  ├─ incremental-indexer.ts      # ★ 신규: 증분 인덱싱
│  ├─ store.ts                    # 수정: 그래프 저장소 연결
│  ├─ graph-rag.ts                # 수정: LightRAG 위임
│  └─ index.ts                    # 수정: export 추가
├─ server/
│  └─ lightrag-server.py          # ★ 신규: LightRAG Python 서버
├─ docker-compose.lightrag.yml    # ★ 신규: Docker 설정
├─ package.json                   # 수정: 의존성 추가
└─ tests/
   ├─ lightrag-adapter.test.ts    # ★ 신규
   ├─ query-engine.test.ts        # ★ 신규
   └─ graph-rag.test.ts           # 수정
```

### 3.2 핵심 구현 코드

#### lightrag-adapter.ts

```typescript
import axios from 'axios';

export interface LightRAGConfig {
  serverUrl: string;        // e.g., http://localhost:8002
  defaultMode: 'local' | 'global' | 'hybrid' | 'mix';
  timeout: number;
}

export interface QueryOptions {
  mode?: 'local' | 'global' | 'hybrid' | 'mix';
  maxTokens?: number;
}

export class LightRAGAdapter {
  private client: axios.AxiosInstance;

  constructor(config: LightRAGConfig) {
    this.client = axios.create({
      baseURL: config.serverUrl,
      timeout: config.timeout ?? 30000,
    });
  }

  // 문서 인덱싱
  async ingest(filePath: string): Promise<{ chunks: number; entities: number }> {
    const response = await this.client.post('/ingest', { file_path: filePath });
    return response.data;
  }

  // 증분 인덱싱 (부분 업데이트)
  async incrementalIngest(filePath: string): Promise<{ added: number; updated: number }> {
    const response = await this.client.post('/ingest/incremental', { file_path: filePath });
    return response.data;
  }

  // 검색 (4가지 모드)
  async query(question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const response = await this.client.post('/query', {
      question,
      mode: options.mode ?? 'mix',
      max_tokens: options.maxTokens ?? 4096,
    });
    return response.data;
  }

  // 헬스 체크
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
```

#### embedding-client.ts

```typescript
import axios from 'axios';

export class EmbeddingClient {
  private client: axios.AxiosInstance;

  constructor(
    private baseUrl: string = 'http://localhost:1234/v1',
    private model: string = 'nomic-embed-text'
  ) {
    this.client = axios.create({ baseURL: baseUrl, timeout: 10000 });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.post('/embeddings', {
      model: this.model,
      input: text,
    });
    return response.data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.post('/embeddings', {
      model: this.model,
      input: texts,
    });
    return response.data.data.map((d: any) => d.embedding);
  }
}
```

#### query-engine.ts

```typescript
import { LightRAGAdapter, QueryOptions } from './lightrag-adapter';

export interface QueryResult {
  answer: string;
  nodes: Array<{ id: string; label: string; content: string; confidence: number }>;
  edges: Array<{ source: string; target: string; relation: string }>;
  confidence: number;
  mode: string;
  latencyMs: number;
}

export class QueryEngine {
  constructor(private rag: LightRAGAdapter) {}

  async search(question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const startTime = Date.now();
    const result = await this.rag.query(question, options);
    const latencyMs = Date.now() - startTime;

    return {
      answer: result.answer,
      nodes: result.nodes ?? [],
      edges: result.edges ?? [],
      confidence: result.confidence ?? 0,
      mode: options.mode ?? 'mix',
      latencyMs,
    };
  }

  // 기존 graph-rag.ts 인터페이스 호환
  async query(question: string): Promise<any> {
    const result = await this.search(question, { mode: 'mix' });
    return {
      nodes: result.nodes,
      edges: result.edges,
      answer: result.answer,
      confidence: result.confidence,
    };
  }
}
```

#### lightrag-server.py

```python
from fastapi import FastAPI, UploadFile
from lightrag import LightRAG
import uvicorn

app = FastAPI()
rag = LightRAG(working_dir="./data")

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/ingest")
async def ingest(file_path: str):
    with open(file_path, "r") as f:
        text = f.read()
    rag.ingest(text)
    return {"chunks": len(text) // 1000, "entities": 0}

@app.post("/ingest/incremental")
async def incremental_ingest(file_path: str):
    with open(file_path, "r") as f:
        text = f.read()
    rag.ingest(text)  # LightRAG는 자동 증분 처리
    return {"added": 1, "updated": 0}

@app.post("/query")
async def query(question: str, mode: str = "mix"):
    result = rag.query(question, param={"mode": mode})
    return {"answer": result, "nodes": [], "edges": [], "confidence": 0.8}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
```

---

## 4. 테스트 계획

### 4.1 단위 테스트

```typescript
// lightrag-adapter.test.ts
describe('LightRAGAdapter', () => {
  it('should ingest document', async () => {
    const adapter = new LightRAGAdapter({ serverUrl: 'http://localhost:8002' });
    const result = await adapter.ingest('./test-doc.txt');
    expect(result.chunks).toBeGreaterThan(0);
  });

  it('should query with mix mode', async () => {
    const adapter = new LightRAGAdapter({ serverUrl: 'http://localhost:8002' });
    const result = await adapter.query('Sangfor EPP 정책', { mode: 'mix' });
    expect(result.answer).toBeTruthy();
  });
});
```

### 4.2 통합 테스트

```typescript
// graph-rag.test.ts
describe('GraphRAG with LightRAG', () => {
  it('should return more accurate results than keyword search', async () => {
    const engine = new QueryEngine(lightragAdapter);
    const result = await engine.search('Sangfor IAG 인증 정책');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});
```

---

## 5. 검증 체크리스트

- [ ] LightRAG 서버 Docker에서 정상 동작
- [ ] LM Studio 임베딩 연동 확인
- [ ] 4가지 검색 모드 동작
- [ ] 증분 인덱싱 동작
- [ ] 기존 v3 테스트와 호환
- [ ] Langfuse에서 트레이싱 확인
- [ ] 코드 리뷰 완료

---

## 6. 병합 조건

1. 모든 테스트 통과
2. LightRAG 서버 Docker 빌드 성공
3. 기존 기능 회귀 없음
4. 코드 리뷰 승인

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
