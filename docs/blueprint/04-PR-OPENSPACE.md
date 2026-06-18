# 📝 PR #3: OpenSpace 기반 스킬 자가 진화 시스템

> **Branch**: `feature/openspace-evolution`
> **Priority**: P1
> **Duration**: 1주
> **의존성**: PR-01 (LightRAG)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 시뮬레이션 → 실제 스킬 학습/진화/공유 |
| **오픈소스** | [OpenSpace](https://github.com/HKUDS/OpenSpace) (46% 토큰 절감) |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드 변화** | 970줄 → ~1,500줄 |

---

## 2. 핵심 기능

### 3가지 진화 모드

| 모드 | 설명 | 예시 |
|------|------|------|
| **FIX** | 실패한 스킬 자동 수정 | "이전 정책 검색 실패 → 검색 쿼리 최적화" |
| **DERIVED** | 기존 스킬에서 새 스킬 생성 | "EPP 검색 스킬 → IAG 검색 스킬로 변형" |
| **CAPTURED** | 성공 실행에서 스킬 추출 | "수동 작업 성공 → 자동화 스킬로 캡처" |

---

## 3. 구현 지침

### 3.1 파일 구조

```
packages/self-evolution/
├─ src/
│  ├─ skill-store.ts          # ★ SQLite 스킬 저장소
│  ├─ evolution-engine.ts     # ★ 진화 엔진 (3가지 모드)
│  ├─ quality-monitor.ts      # ★ 품질 모니터링
│  ├─ skill-capturer.ts       # ★ 스킬 캡처
│  ├─ openspace-adapter.ts    # ★ OpenSpace MCP 어댑터
│  ├─ continuous-learning-kernel.ts  # 수정
│  ├─ improvement-analyzer.ts        # 수정
│  └─ index.ts                       # 수정
├─ skills/                     # 스킬 디렉토리
├─ package.json
└─ tests/
   ├─ skill-store.test.ts
   ├─ evolution-engine.test.ts
   └─ skill-capturer.test.ts
```

### 3.2 핵심 구현 코드

#### skill-store.ts

```typescript
import Database from 'better-sqlite3';

export interface Skill {
  id: string;
  name: string;
  content: string;
  version: number;
  parentId?: string;
  reward: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SkillStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/skills.db') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        parent_id TEXT,
        reward REAL DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async save(skill: Omit<Skill, 'id'>): Promise<Skill> {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO skills (id, name, content, version, parent_id, reward)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, skill.name, skill.content, skill.version, skill.parentId ?? null, skill.reward);
    return { ...skill, id };
  }

  async findById(id: string): Promise<Skill | null> {
    return this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) ?? null;
  }

  async findByName(name: string): Promise<Skill | null> {
    return this.db.prepare('SELECT * FROM skills WHERE name = ? ORDER BY version DESC LIMIT 1').get(name) ?? null;
  }

  async incrementUsage(id: string): Promise<void> {
    this.db.prepare('UPDATE skills SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }
}
```

#### evolution-engine.ts

```typescript
import { SkillStore, Skill } from './skill-store';
import { RapidMLXClient } from '@aios/ai-core';

export class EvolutionEngine {
  constructor(
    private store: SkillStore,
    private llm: RapidMLXClient
  ) {}

  // FIX: 실패한 스킬 자동 수정
  async fixSkill(skill: Skill, failureReview: string): Promise<Skill> {
    const fixed = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        { role: 'system', content: '스킬을 수정하세요. 동일한 구조를 유지하되, 실패 원인을 해결하세요.' },
        { role: 'user', content: `스킬:\n${skill.content}\n\n실패 원인:\n${failureReview}` },
      ],
    });

    return this.store.save({
      name: skill.name,
      content: fixed.choices[0].message.content,
      version: skill.version + 1,
      parentId: skill.id,
      reward: skill.reward,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // DERIVED: 기존 스킬에서 새 스킬 생성
  async deriveSkill(parent: Skill, newContext: string): Promise<Skill> {
    const derived = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        { role: 'system', content: '기존 스킬을 새로운 맥락에 맞게 변형하세요.' },
        { role: 'user', content: `기존 스킬:\n${parent.content}\n\n새 맥락:\n${newContext}` },
      ],
    });

    return this.store.save({
      name: `${parent.name}-derived`,
      content: derived.choices[0].message.content,
      version: 1,
      parentId: parent.id,
      reward: 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // CAPTURED: 성공 실행에서 스킬 추출
  async captureSkill(taskInput: string, executionResult: string, reward: number): Promise<Skill | null> {
    if (reward < 0.8) return null;

    const captured = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        { role: 'system', content: '이 작업 실행 결과를 재사용 가능한 스킬로 정리하세요.' },
        { role: 'user', content: `작업:\n${taskInput}\n\n결과:\n${executionResult}` },
      ],
    });

    return this.store.save({
      name: `captured-${Date.now()}`,
      content: captured.choices[0].message.content,
      version: 1,
      reward,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
```

---

## 4. 검증 체크리스트

- [ ] SQLite 스킬 저장소 동작
- [ ] 3가지 진화 모드 동작
- [ ] 품질 모니터링 동작
- [ ] OpenSpace MCP 연동 확인
- [ ] 기존 self-evolution 코드 호환
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
