/**
 * @aios/evolution - SkillStore
 * SQLite-backed persistent skill storage using better-sqlite3
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Skill, EvolutionMode } from './types.js';

export class SkillStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  /** Initialize the database schema */
  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        parent_id TEXT,
        reward REAL NOT NULL DEFAULT 0.0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_rate REAL NOT NULL DEFAULT 1.0,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES skills(id)
      );

      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_skills_reward ON skills(reward DESC);
      CREATE INDEX IF NOT EXISTS idx_skills_parent_id ON skills(parent_id);
    `);
  }

  /** Save a new skill to the store */
  save(skill: Partial<Skill> & { name: string; content: string }): Skill {
    const now = new Date().toISOString();
    const skillToSave: Skill = {
      id: skill.id ?? uuidv4(),
      name: skill.name,
      content: skill.content,
      version: skill.version ?? 1,
      parentId: skill.parentId ?? null,
      reward: skill.reward ?? 0.0,
      usageCount: skill.usageCount ?? 0,
      successRate: skill.successRate ?? 1.0,
      metadata: skill.metadata ?? {},
      createdAt: skill.createdAt ?? now,
      updatedAt: skill.updatedAt ?? now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO skills (id, name, content, version, parent_id, reward, usage_count, success_rate, metadata, created_at, updated_at)
      VALUES (@id, @name, @content, @version, @parent_id, @reward, @usage_count, @success_rate, @metadata, @created_at, @updated_at)
    `);

    stmt.run({
      id: skillToSave.id,
      name: skillToSave.name,
      content: skillToSave.content,
      version: skillToSave.version,
      parent_id: skillToSave.parentId,
      reward: skillToSave.reward,
      usage_count: skillToSave.usageCount,
      success_rate: skillToSave.successRate,
      metadata: JSON.stringify(skillToSave.metadata),
      created_at: skillToSave.createdAt,
      updated_at: skillToSave.updatedAt,
    });

    return skillToSave;
  }

  /** Find a skill by ID */
  findById(id: string): Skill | null {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
    return row ? this.rowToSkill(row) : null;
  }

  /** Find skills by name (returns all versions) */
  findByName(name: string): Skill[] {
    const rows = this.db.prepare('SELECT * FROM skills WHERE name = ? ORDER BY version DESC').all(name) as any[];
    return rows.map((row) => this.rowToSkill(row));
  }

  /** Find top skills by reward */
  findTopSkills(limit: number = 10): Skill[] {
    const rows = this.db
      .prepare('SELECT * FROM skills ORDER BY reward DESC, success_rate DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((row) => this.rowToSkill(row));
  }

  /** Increment usage count for a skill */
  incrementUsage(id: string): Skill | null {
    const stmt = this.db.prepare(`
      UPDATE skills SET usage_count = usage_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(id);
    return this.findById(id);
  }

  /** Update a skill's properties */
  update(id: string, updates: Partial<Pick<Skill, 'content' | 'reward' | 'successRate' | 'metadata'>>): Skill | null {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id, updated_at: new Date().toISOString() };

    if (updates.content !== undefined) {
      fields.push('content = @content');
      values.content = updates.content;
    }
    if (updates.reward !== undefined) {
      fields.push('reward = @reward');
      values.reward = updates.reward;
    }
    if (updates.successRate !== undefined) {
      fields.push('success_rate = @success_rate');
      values.success_rate = updates.successRate;
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = @metadata');
      values.metadata = JSON.stringify(updates.metadata);
    }

    if (fields.length === 0) return this.findById(id);

    const sql = `UPDATE skills SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`;
    this.db.prepare(sql).run(values);
    return this.findById(id);
  }

  /** Get the latest version of a skill by name */
  findLatest(name: string): Skill | null {
    const row = this.db
      .prepare('SELECT * FROM skills WHERE name = ? ORDER BY version DESC LIMIT 1')
      .get(name) as any;
    return row ? this.rowToSkill(row) : null;
  }

  /** Get all skill lineage (parent -> child chain) */
  getLineage(id: string): Skill[] {
    const lineage: Skill[] = [];
    let currentId: string | null = id;
    while (currentId) {
      const skill = this.findById(currentId);
      if (skill) {
        lineage.unshift(skill);
        currentId = skill.parentId;
      } else {
        break;
      }
    }
    return lineage;
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }

  /** Convert a database row to a Skill object */
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
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
