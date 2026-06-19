# 📝 PR-05: OpenSpace 기반 스킬 자가 진화

> **Branch**: `feature/pr-05-openspace`
> **Priority**: P1
> **Duration**: 5일
> **의존성**: PR-03 (LightRAG)

---

## 1. PR 개요

| 항목 | 내용 |
|------|------|
| **목적** | 시뮬레이션 → 실제 스킬 학습/진화/공유 |
| **오픈소스** | [OpenSpace](https://github.com/HKUDS/OpenSpace) (46% 토큰 절감) |
| **영향 패키지** | `packages/self-evolution/` |
| **예상 코드** | 970줄 → ~2,000줄 |

---

## 2. 3가지 진화 모드

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
│  ├─ evolution-engine.ts     # ★ 진화 엔진
│  ├─ quality-monitor.ts      # ★ 품질 모니터링
│  ├─ skill-capturer.ts       # ★ 스킬 캡처
│  ├─ openspace-adapter.ts    # ★ OpenSpace MCP 어댑터
│  └─ index.ts
├─ data/
│  └─ skills.db               # SQLite DB
├─ package.json
└─ tests/
```

### 3.2 핵심 구현

#### skill-store.ts

```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface Skill {
  id: string;
  name: string;
  content: string;
  version: number;
  parentId?: string;
  reward: number;
  usageCount: number;
  successRate: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillSearchResult {
  skill: Skill;
  score: number;
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
        success_rate REAL DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES skills(id)
      );

      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_skills_parent ON skills(parent_id);
      CREATE INDEX IF NOT EXISTS idx_skills_reward ON skills(reward DESC);
    `);
  }

  # 스킬 저장
  async save(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Promise<Skill> {
    const id = uuidv4();
    const now = new Date();

    this.db.prepare(`
      INSERT INTO skills (id, name, content, version, parent_id, reward, usage_count, success_rate, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, skill.name, skill.content, skill.version,
      skill.parentId ?? null, skill.reward,
      skill.usageCount, skill.successRate,
      JSON.stringify(skill.metadata),
      now.toISOString(), now.toISOString()
    );

    return { ...skill, id, createdAt: now, updatedAt: now };
  }

  # 스킬 조회
  async findById(id: string): Promise<Skill | null> {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.rowToSkill(row);
  }

  # 이름으로 검색
  async findByName(name: string): Promise<Skill[]> {
    const rows = this.db.prepare(
      'SELECT * FROM skills WHERE name = ? ORDER BY version DESC'
    ).all(name) as any[];
    return rows.map(this.rowToSkill);
  }

  # 보상으로 정렬
  async findTopSkills(limit: number = 10): Promise<Skill[]> {
    const rows = this.db.prepare(
      'SELECT * FROM skills ORDER BY reward DESC LIMIT ?'
    ).all(limit) as any[];
    return rows.map(this.rowToSkill);
  }

  # 사용 기록 업데이트
  async incrementUsage(id: string, success: boolean): Promise<void> {
    const skill = await this.findById(id);
    if (!skill) return;

    const newUsageCount = skill.usageCount + 1;
    const newSuccessRate = (skill.successRate * skill.usageCount + (success ? 1 : 0)) / newUsageCount;

    this.db.prepare(`
      UPDATE skills
      SET usage_count = ?, success_rate = ?, updated_at = ?
      WHERE id = ?
    `).run(newUsageCount, newSuccessRate, new Date().toISOString(), id);
  }

  # 스킬 수정 (FIX)
  async update(id: string, updates: Partial<Skill>): Promise<void> {
    const skill = await this.findById(id);
    if (!skill) return;

    const newVersion = skill.version + 1;

    this.db.prepare(`
      UPDATE skills
      SET content = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updates.content ?? skill.content,
      newVersion,
      new Date().toISOString(),
      id
    );
  }

  # 전체 스킬 조회
  async findAll(): Promise<Skill[]> {
    const rows = this.db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all() as any[];
    return rows.map(this.rowToSkill);
  }

  # 통계
  async getStats(): Promise<{
    totalSkills: number;
    averageReward: number;
    averageUsage: number;
    topSkills: Skill[];
  }> {
    const totalSkills = (this.db.prepare('SELECT COUNT(*) as count').get() as any).count;
    const avgReward = (this.db.prepare('SELECT AVG(reward) as avg').get() as any).avg ?? 0;
    const avgUsage = (this.db.prepare('SELECT AVG(usage_count) as avg').get() as any).avg ?? 0;
    const topSkills = await this.findTopSkills(5);

    return { totalSkills, averageReward: avgReward, averageUsage: avgUsage, topSkills };
  }

  private rowToSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      version: row.version,
      parentId: row.parent_id,
      reward: row.reward,
      usageCount: row.usage_count,
      successRate: row.success_rate,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
```

#### evolution-engine.ts

```typescript
import { SkillStore, Skill } from './skill-store';
import { RapidMLXClient } from '@aios/ai-core';

export type EvolutionMode = 'FIX' | 'DERIVED' | 'CAPTURED';

export interface EvolutionResult {
  mode: EvolutionMode;
  skill: Skill;
  reason: string;
  metrics: {
    rewardImprovement: number;
    previousVersion: number;
  };
}

export class EvolutionEngine {
  constructor(
    private store: SkillStore,
    private llm: RapidMLXClient
  ) {}

  # FIX: 실패한 스킬 자동 수정
  async fixSkill(skill: Skill, failureReview: string): Promise<EvolutionResult> {
    const fixed = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `스킬을 수정하세요. 다음 규칙을 따르세요:
1. 동일한 구조를 유지하세요
2. 실패 원인을 해결하세요
3. 이전 버전보다 명확하게 작성하세요`
        },
        {
          role: 'user',
          content: `현재 스킬:
이름: ${skill.name}
내용:
${skill.content}

실패 원인:
${failureReview}

수정된 스킬:`
        },
      ],
    });

    const newSkill = await this.store.save({
      name: skill.name,
      content: fixed.choices[0].message.content,
      version: skill.version + 1,
      parentId: skill.id,
      reward: skill.reward * 0.9,
      usageCount: 0,
      successRate: 0,
      metadata: { ...skill.metadata, evolutionMode: 'FIX' },
    });

    return {
      mode: 'FIX',
      skill: newSkill,
      reason: `실패 원인 "${failureReview.slice(0, 50)}..." 기반 수정`,
      metrics: {
        rewardImprovement: newSkill.reward - skill.reward,
        previousVersion: skill.version,
      },
    };
  }

  # DERIVED: 기존 스킬에서 새 스킬 생성
  async deriveSkill(parent: Skill, newContext: string): Promise<EvolutionResult> {
    const derived = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `기존 스킬을 새로운 맥락에 맞게 변형하세요.
새 스킬은 기존 스킬의 핵심 패턴을 유지하되, 새로운 맥락에 최적화되어야 합니다.`
        },
        {
          role: 'user',
          content: `기존 스킬:
이름: ${parent.name}
내용:
${parent.content}

새 맥락:
${newContext}

변형된 스킬:`
        },
      ],
    });

    const newSkill = await this.store.save({
      name: `${parent.name}-derived`,
      content: derived.choices[0].message.content,
      version: 1,
      parentId: parent.id,
      reward: parent.reward * 0.7,
      usageCount: 0,
      successRate: 0,
      metadata: {
        ...parent.metadata,
        evolutionMode: 'DERIVED',
        parentName: parent.name,
        newContext,
      },
    });

    return {
      mode: 'DERIVED',
      skill: newSkill,
      reason: `"${parent.name}"에서 새 맥락 "${newContext.slice(0, 30)}..."으로 변형`,
      metrics: {
        rewardImprovement: 0,
        previousVersion: 0,
      },
    };
  }

  # CAPTURED: 성공 실행에서 스킬 추출
  async captureSkill(
    taskInput: string,
    executionResult: string,
    reward: number
  ): Promise<EvolutionResult | null> {
    if (reward < 0.8) return null;

    const captured = await this.llm.chatCompletion({
      model: 'qwen3.5-9b',
      messages: [
        {
          role: 'system',
          content: `이 작업 실행 결과를 재사용 가능한 스킬로 정리하세요.
스킬은 다음 형식을 따라야 합니다:
- 이름: 어떤 작업인지
- 내용: 단계별 절차`
        },
        {
          role: 'user',
          content: `작업:
${taskInput}

실행 결과:
${executionResult}

스킬:`
        },
      ],
    });

    const newSkill = await this.store.save({
      name: `captured-${Date.now()}`,
      content: captured.choices[0].message.content,
      version: 1,
      reward,
      usageCount: 1,
      successRate: 1,
      metadata: {
        evolutionMode: 'CAPTURED',
        originalTask: taskInput,
        capturedAt: new Date().toISOString(),
      },
    });

    return {
      mode: 'CAPTURED',
      skill: newSkill,
      reason: `보상 ${reward}로 성공적으로 캡처`,
      metrics: {
        rewardImprovement: 0,
        previousVersion: 0,
      },
    };
  }

  # 자동 진화 (보상 기반 판단)
  async autoEvolve(
    taskInput: string,
    executionResult: string,
    reward: number,
    failureReview?: string
  ): Promise<EvolutionResult | null> {
    if (reward < 0.8) {
      # 실패: FIX 시도
      if (failureReview) {
        const existingSkills = await this.store.findByName(this.extractSkillName(taskInput));
        if (existingSkills.length > 0) {
          return this.fixSkill(existingSkills[0], failureReview);
        }
      }
      return null;
    }

    # 성공: CAPTURED 시도
    return this.captureSkill(taskInput, executionResult, reward);
  }

  private extractSkillName(taskInput: string): string {
    return taskInput.slice(0, 50).replace(/[^a-zA-Z0-9가-힣]/g, '-');
  }
}
```

---

## 4. 테스트 계획

```typescript
describe('SkillStore', () => {
  it('should save and retrieve skill', async () => {
    const store = new SkillStore(':memory:');
    const skill = await store.save({
      name: 'test-skill',
      content: 'test content',
      version: 1,
      reward: 0.8,
      usageCount: 0,
      successRate: 0,
      metadata: {},
    });

    const retrieved = await store.findById(skill.id);
    expect(retrieved?.name).toBe('test-skill');
  });
});

describe('EvolutionEngine', () => {
  it('should fix failed skill', async () => {
    const engine = new EvolutionEngine(mockStore, mockLLM);
    const result = await engine.fixSkill(mockSkill, '검색 쿼리가 너무 구체적');
    expect(result.mode).toBe('FIX');
  });

  it('should capture successful execution', async () => {
    const engine = new EvolutionEngine(mockStore, mockLLM);
    const result = await engine.captureSkill('작업', '결과', 0.9);
    expect(result?.mode).toBe('CAPTURED');
  });
});
```

---

## 5. 검증 체크리스트

- [ ] SQLite 스킬 저장소 동작
- [ ] 3가지 진화 모드 동작
- [ ] 자동 진화 로직 동작
- [ ] 품질 모니터링 동작
- [ ] 기존 self-evolution 코드 호환
- [ ] 테스트 커버리지 80%+

---

**최종 업데이트**: 2026-06-10
**작성자**: Hermes Agent
