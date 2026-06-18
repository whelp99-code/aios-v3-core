# 📝 PR-10: Google A2A 프로토콜

> **Branch**: `feature/pr-10-a2a`
> **Priority**: P2
> **Duration**: 5일
> **의존성**: PR-06 (Mastra)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 독립 에이전트 → 상호운용 에이전트 (CrewAI, OpenHands 등과 협업) |
| **오픈소스** | [Google A2A](https://github.com/a2aproject/A2A) (⭐ 15k+, Linux Foundation) |
| **영향 패키지** | `packages/a2a-protocol/` (신규) |
| **예상 코드** | 신규 ~800줄 |

---

## 2. A2A vs MCP

| 비교 | MCP | A2A |
|------|-----|-----|
| **목적** | 에이전트 ↔ 도구/데이터 | 에이전트 ↔ 에이전트 |
| **통신** | 단방향 호출 | 양방향 협업 |
| **프로토콜** | JSON-RPC | JSON-RPC 2.0 + HTTP/SSE |
| **주도** | Anthropic | Google / Linux Foundation |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/a2a-protocol/
├─ src/
│  ├─ a2a-agent.ts            # A2A 에이전트 정의
│  ├─ a2a-server.ts           # A2A 서버
│  ├─ a2a-client.ts           # A2A 클라이언트
│  ├─ a2a-discovery.ts        # 에이전트 발견
│  ├─ a2a-task-manager.ts     # 태스트 관리
│  ├─ a2a-security.ts         # 보안 인증
│  └─ index.ts
├─ package.json
└─ tests/
```

### 3.2 핵심 구현

#### a2a-agent.ts

```typescript
export interface A2AAgentConfig {
  name: string;
  description: string;
  skills: string[];
  url: string;
  version: string;
}

export interface A2ATask {
  id: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface A2AResponse {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export class A2AAgent {
  private config: A2AAgentConfig;
  private taskHandlers: Map<string, (task: A2ATask) => Promise<any>> = new Map();

  constructor(config: A2AAgentConfig) {
    this.config = config;
  }

  # 태스트 핸들러 등록
  registerHandler(skill: string, handler: (task: A2ATask) => Promise<any>): void {
    this.taskHandlers.set(skill, handler);
  }

  # 태스트 처리
  async handleTask(task: A2ATask): Promise<A2AResponse> {
    try {
      # 핸들러 찾기
      const handler = this.taskHandlers.get(task.message);
      if (!handler) {
        return {
          taskId: task.id,
          status: 'failed',
          error: `No handler for skill: ${task.message}`,
        };
      }

      # 핸들러 실행
      const result = await handler(task);

      return {
        taskId: task.id,
        status: 'completed',
        result,
      };

    } catch (error) {
      return {
        taskId: task.id,
        status: 'failed',
        error: String(error),
      };
    }
  }

  # 에이전트 정보 조회
  getAgentCard(): {
    name: string;
    description: string;
    skills: string[];
    url: string;
    version: string;
  } {
    return {
      name: this.config.name,
      description: this.config.description,
      skills: this.config.skills,
      url: this.config.url,
      version: this.config.version,
    };
  }
}
```

#### a2a-server.ts

```typescript
import express from 'express';
import { A2AAgent, A2ATask } from './a2a-agent';

export class A2AServer {
  private app: express.Application;
  private agent: A2AAgent;

  constructor(agent: A2AAgent, port: number = 4000) {
    this.app = express();
    this.agent = agent;
    this.setupRoutes();
  }

  private setupRoutes() {
    # 에이전트 카드 조회
    this.app.get('/.well-known/agent.json', (req, res) => {
      res.json(this.agent.getAgentCard());
    });

    # 태스트 수신
    this.app.post('/tasks/send', async (req, res) => {
      const task: A2ATask = {
        id: `task-${Date.now()}`,
        message: req.body.message,
        metadata: req.body.metadata,
      };

      const response = await this.agent.handleTask(task);
      res.json(response);
    });

    # 태스트 상태 조회
    this.app.get('/tasks/:taskId', (req, res) => {
      # 실제 구현에서는 태스트 상태 저장소 필요
      res.json({ taskId: req.params.taskId, status: 'unknown' });
    });

    # 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
  }

  # 서버 시작
  async start(port: number = 4000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`[A2A Server] 포트 ${port}에서 실행 중`);
        resolve();
      });
    });
  }
}
```

#### a2a-client.ts

```typescript
import axios from 'axios';

export interface A2AClientConfig {
  timeout: number;
  retries: number;
}

export class A2AClient {
  private config: A2AClientConfig;

  constructor(config: Partial<A2AClientConfig> = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };
  }

  # 에이전트 카드 조회
  async getAgentCard(url: string): Promise<any> {
    const response = await axios.get(`${url}/.well-known/agent.json`, {
      timeout: this.config.timeout,
    });
    return response.data;
  }

  # 태스트 전송
  async sendTask(
    agentUrl: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const response = await axios.post(`${agentUrl}/tasks/send`, {
      message,
      metadata,
    }, {
      timeout: this.config.timeout,
    });
    return response.data;
  }

  # 태스트 상태 조회
  async getTaskStatus(agentUrl: string, taskId: string): Promise<any> {
    const response = await axios.get(`${agentUrl}/tasks/${taskId}`, {
      timeout: this.config.timeout,
    });
    return response.data;
  }

  # 에이전트 헬스 체크
  async healthCheck(agentUrl: string): Promise<boolean> {
    try {
      await axios.get(`${agentUrl}/health`, {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

#### a2a-discovery.ts

```typescript
import { A2AClient } from './a2a-client';

export interface DiscoveredAgent {
  name: string;
  url: string;
  skills: string[];
  version: string;
  lastSeen: Date;
}

export class A2ADiscovery {
  private knownAgents: Map<string, DiscoveredAgent> = new Map();
  private client: A2AClient;

  constructor() {
    this.client = new A2AClient();
  }

  # 에이전트 검색
  async discover(url: string): Promise<DiscoveredAgent | null> {
    try {
      const card = await this.client.getAgentCard(url);
      const agent: DiscoveredAgent = {
        name: card.name,
        url,
        skills: card.skills,
        version: card.version,
        lastSeen: new Date(),
      };

      this.knownAgents.set(url, agent);
      return agent;

    } catch {
      return null;
    }
  }

  # 스킬로 에이전트 검색
  findBySkill(skill: string): DiscoveredAgent[] {
    return Array.from(this.knownAgents.values())
      .filter(agent => agent.skills.includes(skill));
  }

  # 전체 에이전트 목록
  getAllAgents(): DiscoveredAgent[] {
    return Array.from(this.knownAgents.values());
  }

  # 에이전트 상태 업데이트
  async refreshAgent(url: string): Promise<void> {
    const agent = this.knownAgents.get(url);
    if (agent) {
      agent.lastSeen = new Date();
    }
  }
}
```

---

## 4. 테스트 계획

```typescript
describe('A2AAgent', () => {
  it('should handle task', async () => {
    const agent = new A2AAgent(mockConfig);
    agent.registerHandler('test', async (task) => `Result: ${task.message}`);

    const response = await agent.handleTask({
      id: '1',
      message: 'test',
    });

    expect(response.status).toBe('completed');
  });
});

describe('A2AClient', () => {
  it('should send task', async () => {
    const client = new A2AClient();
    const response = await client.sendTask('http://localhost:4000', 'hello');
    expect(response.taskId).toBeDefined();
  });
});
```

---

## 5. 검증 체크리스트

- [ ] A2A 에이전트 등록 동작
- [ ] A2A 서버 동작
- [ ] 에이전트 발견 동작
- [ ] 태스트 위임 동작
- [ ] 보안 토큰 인증 동작
- [ ] 기존 MCP 어댑터 호환
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
