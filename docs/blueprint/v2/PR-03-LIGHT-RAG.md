# 📝 PR-03: LightRAG 기반 GraphRAG 재구현

> **Branch**: `feature/pr-03-lightrag`
> **Priority**: P0
> **Duration**: 5일
> **의존성**: PR-01 (Langfuse)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 36줄 단순 키워드 검색 → LightRAG 기반 프로덕션 수준 그래프 검색 |
| **오픈소스** | [LightRAG](https://github.com/HKUDS/LightRAG) (⭐ 36.3k, EMNLP 2025) |
| **영향 패키지** | `packages/knowledge-graph/` |
| **예상 코드** | 584줄 → ~1,500줄 |

---

## 2. 기술 설계

### 2.1 아키텍처

```
현재:
  TypeScript → 메모리 기반 그래프 → 단순 필터링 (36줄)

목표:
  TypeScript 어댑터 → HTTP → LightRAG Python 서버
                                    ↓
                              LM Studio (임베딩)
                                    ↓
                              그래프 저장소 (Neo4j/PostgreSQL)
```

### 2.2 검색 모드

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
│  ├─ lightrag-adapter.ts         # ★ TypeScript 어댑터
│  ├─ embedding-client.ts         # ★ LM Studio 임베딩
│  ├─ query-engine.ts             # ★ 검색 엔진 (4가지 모드)
│  ├─ incremental-indexer.ts      # ★ 증분 인덱싱
│  ├─ store.ts                    # 수정: 그래프 저장소
│  ├─ graph-rag.ts                # 수정: LightRAG 위임
│  └─ index.ts                    # 수정: export 추가
├─ server/
│  ├─ lightrag_server.py          # ★ Python 서버
│  └─ requirements.txt            # ★ Python 의존성
├─ docker/
│  └─ Dockerfile.lightrag         # ★ Docker 이미지
├─ docker-compose.lightrag.yml    # ★ Docker Compose
├─ package.json                   # 수정
└─ tests/
   ├─ lightrag-adapter.test.ts
   ├─ query-engine.test.ts
   └─ integration.test.ts
```

### 3.2 핵심 구현

#### lightrag-adapter.ts

```typescript
import axios, { AxiosInstance } from 'axios';

export interface LightRAGConfig {
  serverUrl: string;        # e.g., http://localhost:8002
  defaultMode: 'local' | 'global' | 'hybrid' | 'mix';
  timeout: number;
  retries: number;
}

export interface QueryOptions {
  mode?: 'local' | 'global' | 'hybrid' | 'mix';
  maxTokens?: number;
  stream?: boolean;
}

export interface QueryResult {
  answer: string;
  nodes: Array<{
    id: string;
    label: string;
    content: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relation: string;
    weight?: number;
  }>;
  confidence: number;
  mode: string;
  latencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class LightRAGAdapter {
  private client: AxiosInstance;
  private config: LightRAGConfig;

  constructor(config: Partial<LightRAGConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl ?? 'http://localhost:8002',
      defaultMode: config.defaultMode ?? 'mix',
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };

    this.client = axios.create({
      baseURL: this.config.serverUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    # 재시도 인터셉터
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          await this.sleep(1000);
          throw error;  # 재시도 로직은 외부에서 처리
        }
        throw error;
      }
    );
  }

  # 문서 인덱싱
  async ingest(filePath: string): Promise<{
    chunks: number;
    entities: number;
    relations: number;
    latencyMs: number;
  }> {
    const startTime = Date.now();
    const response = await this.client.post('/ingest', {
      file_path: filePath,
    });
    return {
      ...response.data,
      latencyMs: Date.now() - startTime,
    };
  }

  # 증분 인덱싱 (부분 업데이트)
  async incrementalIngest(filePath: string): Promise<{
    added: number;
    updated: number;
    removed: number;
    latencyMs: number;
  }> {
    const startTime = Date.now();
    const response = await this.client.post('/ingest/incremental', {
      file_path: filePath,
    });
    return {
      ...response.data,
      latencyMs: Date.now() - startTime,
    };
  }

  # 검색 (4가지 모드)
  async query(
    question: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const mode = options.mode ?? this.config.defaultMode;

    const response = await this.client.post('/query', {
      question,
      mode,
      max_tokens: options.maxTokens ?? 4096,
      stream: options.stream ?? false,
    });

    const latencyMs = Date.now() - startTime;

    return {
      answer: response.data.answer,
      nodes: response.data.nodes ?? [],
      edges: response.data.edges ?? [],
      confidence: response.data.confidence ?? 0,
      mode,
      latencyMs,
      tokenUsage: {
        prompt: response.data.token_usage?.prompt ?? 0,
        completion: response.data.token_usage?.completion ?? 0,
        total: response.data.token_usage?.total ?? 0,
      },
    };
  }

  # 스트리밍 검색
  async *queryStream(
    question: string,
    options: QueryOptions = {}
  ): AsyncGenerator<{ type: string; content: string }> {
    const mode = options.mode ?? this.config.defaultMode;

    const response = await this.client.post('/query', {
      question,
      mode,
      stream: true,
    }, {
      responseType: 'stream',
    });

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch {
            # 파싱 에러 무시
          }
        }
      }
    }
  }

  # 헬스 체크
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latencyMs: number;
    version?: string;
  }> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/health');
      return {
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        version: response.data.version,
      };
    } catch {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  # 통계 조회
  async getStats(): Promise<{
    totalDocuments: number;
    totalEntities: number;
    totalRelations: number;
    indexSizeMB: number;
  }> {
    const response = await this.client.get('/stats');
    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### embedding-client.ts

```typescript
import axios from 'axios';

export interface EmbeddingConfig {
  baseUrl: string;       # LM Studio URL
  model: string;         # 임베딩 모델
  dimensions: number;    # 임베딩 차원
}

export class EmbeddingClient {
  private client: axios.AxiosInstance;
  private config: EmbeddingConfig;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://localhost:1234/v1',
      model: config.model ?? 'nomic-embed-text',
      dimensions: config.dimensions ?? 768,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
    });
  }

  # 단일 임베딩
  async embed(text: string): Promise<number[]> {
    const response = await this.client.post('/embeddings', {
      model: this.config.model,
      input: text,
    });
    return response.data.data[0].embedding;
  }

  # 배치 임베딩
  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.post('/embeddings', {
      model: this.config.model,
      input: texts,
    });
    return response.data.data.map((d: any) => d.embedding);
  }

  # 유사도 계산
  cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
  }

  # 헬스 체크
  async healthCheck(): Promise<boolean> {
    try {
      await this.embed('test');
      return true;
    } catch {
      return false;
    }
  }
}
```

#### query-engine.ts

```typescript
import { LightRAGAdapter, QueryOptions, QueryResult } from './lightrag-adapter';

export interface EnhancedQueryResult extends QueryResult {
  suggestions: string[];      # 후속 질문 제안
  relatedTopics: string[];    # 관련 주제
  confidenceLevel: 'high' | 'medium' | 'low';
}

export class QueryEngine {
  constructor(private rag: LightRAGAdapter) {}

  # 향상된 검색
  async search(
    question: string,
    options: QueryOptions = {}
  ): Promise<EnhancedQueryResult> {
    const result = await this.rag.query(question, options);

    # 신뢰도 레벨 계산
    const confidenceLevel = this.getConfidenceLevel(result.confidence);

    # 후속 질문 제안
    const suggestions = this.generateSuggestions(result);

    # 관련 주제 추출
    const relatedTopics = this.extractRelatedTopics(result);

    return {
      ...result,
      suggestions,
      relatedTopics,
      confidenceLevel,
    };
  }

  # 기존 graph-rag.ts 인터페이스 호환
  async query(question: string): Promise<any> {
    const result = await this.search(question, { mode: 'mix' });
    return {
      nodes: result.nodes,
      edges: result.edges,
      answer: result.answer,
      confidence: result.confidence,
    };
  }

  # 멀티 모드 검색 (모든 모드 비교)
  async searchMultiMode(question: string): Promise<{
    local: QueryResult;
    global: QueryResult;
    hybrid: QueryResult;
    mix: QueryResult;
    best: QueryResult;
  }> {
    const [local, global, hybrid, mix] = await Promise.all([
      this.rag.query(question, { mode: 'local' }),
      this.rag.query(question, { mode: 'global' }),
      this.rag.query(question, { mode: 'hybrid' }),
      this.rag.query(question, { mode: 'mix' }),
    ]);

    # 가장 높은 신뢰도의 결과를 best로 선택
    const results = [local, global, hybrid, mix];
    const best = results.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );

    return { local, global, hybrid, mix, best };
  }

  # 블렌딩 검색 (여러 모드 결과 블렌딩)
  async searchBlended(
    question: string,
    weights: { local: number; global: number; hybrid: number } = {
      local: 0.4,
      global: 0.4,
      hybrid: 0.2,
    }
  ): Promise<QueryResult> {
    const [local, global, hybrid] = await Promise.all([
      this.rag.query(question, { mode: 'local' }),
      this.rag.query(question, { mode: 'global' }),
      this.rag.query(question, { mode: 'hybrid' }),
    ]);

    # 가중 평균으로 신뢰도 계산
    const blendedConfidence =
      local.confidence * weights.local +
      global.confidence * weights.global +
      hybrid.confidence * weights.hybrid;

    # 가장 높은 신뢰도의 답변 선택
    const answers = [local, global, hybrid];
    const bestAnswer = answers.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );

    # 노드/엣지 병합
    const allNodes = [...local.nodes, ...global.nodes, ...hybrid.nodes];
    const allEdges = [...local.edges, ...global.edges, ...hybrid.edges];

    # 중복 제거
    const uniqueNodes = this.deduplicateNodes(allNodes);
    const uniqueEdges = this.deduplicateEdges(allEdges);

    return {
      answer: bestAnswer.answer,
      nodes: uniqueNodes,
      edges: uniqueEdges,
      confidence: blendedConfidence,
      mode: 'blended',
      latencyMs: local.latencyMs + global.latencyMs + hybrid.latencyMs,
      tokenUsage: {
        prompt: local.tokenUsage.prompt + global.tokenUsage.prompt + hybrid.tokenUsage.prompt,
        completion: local.tokenUsage.completion + global.tokenUsage.completion + hybrid.tokenUsage.completion,
        total: local.tokenUsage.total + global.tokenUsage.total + hybrid.tokenUsage.total,
      },
    };
  }

  private getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  private generateSuggestions(result: QueryResult): string[] {
    const suggestions: string[] = [];

    # 노드 기반 후속 질문
    if (result.nodes.length > 0) {
      const topNode = result.nodes[0];
      suggestions.push(`${topNode.label}에 대한 상세 정보`);
    }

    # 엣지 기반 후속 질문
    if (result.edges.length > 0) {
      const topEdge = result.edges[0];
      suggestions.push(`${topEdge.source}와 ${topEdge.target}의 관계`);
    }

    return suggestions.slice(0, 3);
  }

  private extractRelatedTopics(result: QueryResult): string[] {
    const topics = new Set<string>();
    for (const node of result.nodes) {
      topics.add(node.label);
    }
    return [...topics].slice(0, 5);
  }

  private deduplicateNodes(nodes: any[]): any[] {
    const seen = new Set<string>();
    return nodes.filter(node => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }

  private deduplicateEdges(edges: any[]): any[] {
    const seen = new Set<string>();
    return edges.filter(edge => {
      const key = `${edge.source}-${edge.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
```

#### lightrag_server.py

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from lightrag import LightRAG
from lightrag.llm import openai_embedding
import uvicorn
import os

app = FastAPI(title="LightRAG Server", version="1.0.0")

# 설정
WORKING_DIR = os.getenv("WORKING_DIR", "./data")
LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1")

# LightRAG 초기화
rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func="qwen3.5-9b",
    llm_model_name="qwen3.5-9b",
    llm_base_url=LM_STUDIO_URL,
    embedding_func=openai_embedding(
        model="nomic-embed-text",
        api_base=LM_STUDIO_URL,
    ),
)

class IngestRequest(BaseModel):
    file_path: str

class QueryRequest(BaseModel):
    question: str
    mode: str = "mix"
    max_tokens: int = 4096
    stream: bool = False

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/stats")
async def stats():
    return {
        "totalDocuments": len(rag.texts) if hasattr(rag, 'texts') else 0,
        "totalEntities": len(rag.entities) if hasattr(rag, 'entities') else 0,
        "totalRelations": len(rag.relations) if hasattr(rag, 'relations') else 0,
        "indexSizeMB": 0,
    }

@app.post("/ingest")
async def ingest(request: IngestRequest):
    try:
        with open(request.file_path, "r", encoding="utf-8") as f:
            text = f.read()
        rag.ingest(text)
        return {
            "chunks": len(text) // 1000 + 1,
            "entities": 0,
            "relations": 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/incremental")
async def incremental_ingest(request: IngestRequest):
    try:
        with open(request.file_path, "r", encoding="utf-8") as f:
            text = f.read()
        rag.ingest(text)
        return {
            "added": 1,
            "updated": 0,
            "removed": 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query(request: QueryRequest):
    try:
        result = rag.query(
            request.question,
            param={"mode": request.mode}
        )
        return {
            "answer": result,
            "nodes": [],
            "edges": [],
            "confidence": 0.8,
            "token_usage": {
                "prompt": 0,
                "completion": 0,
                "total": 0,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
```

---

## 4. Docker 설정

```dockerfile
# docker/Dockerfile.lightrag
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 서버 복사
COPY server/ .

# 포트 노출
EXPOSE 8002

# 실행
CMD ["python", "lightrag_server.py"]
```

```txt
# server/requirements.txt
fastapi==0.115.0
uvicorn==0.32.0
lightrag-hku==0.1.0
openai==1.50.0
```

```yaml
# docker-compose.lightrag.yml
version: '3.8'

services:
  lightrag:
    build:
      context: .
      dockerfile: docker/Dockerfile.lightrag
    container_name: aios-lightrag
    ports:
      - "8002:8002"
    environment:
      - WORKING_DIR=/data
      - LM_STUDIO_URL=http://host.docker.internal:1234/v1
    volumes:
      - lightrag-data:/data
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  lightrag-data:
    driver: local
```

---

## 5. 테스트 계획

```typescript
// lightrag-adapter.test.ts
describe('LightRAGAdapter', () => {
  let adapter: LightRAGAdapter;

  beforeEach(() => {
    adapter = new LightRAGAdapter({
      serverUrl: 'http://localhost:8002',
    });
  });

  it('should ingest document', async () => {
    const result = await adapter.ingest('./test-doc.txt');
    expect(result.chunks).toBeGreaterThan(0);
  });

  it('should query with mix mode', async () => {
    const result = await adapter.query('Sangfor EPP 정책', { mode: 'mix' });
    expect(result.answer).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should health check', async () => {
    const result = await adapter.healthCheck();
    expect(result.status).toBe('healthy');
  });
});

// query-engine.test.ts
describe('QueryEngine', () => {
  it('should search and return enhanced result', async () => {
    const engine = new QueryEngine(mockAdapter);
    const result = await engine.search('Sangfor IAG 인증 정책');
    expect(result.confidenceLevel).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });
});
```

---

## 6. 검증 체크리스트

- [ ] LightRAG Docker 빌드 성공
- [ ] LM Studio 임베딩 연동 확인
- [ ] 4가지 검색 모드 동작
- [ ] 증분 인덱싱 동작
- [ ] 스트리밍 검색 동작
- [ ] 기존 v3 테스트와 호환
- [ ] Langfuse에서 트레이싱 확인
- [ ] 테스트 커버리지 80%+
- [ ] 코드 리뷰 완료

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
