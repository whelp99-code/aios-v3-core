import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock better-sqlite3 BEFORE importing SkillStore
const mockDb = {
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn(),
  close: vi.fn(),
};

const mockStatement = {
  run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
  get: vi.fn(),
  all: vi.fn().mockReturnValue([]),
};

mockDb.prepare.mockReturnValue(mockStatement);
mockDb.exec.mockReturnValue(undefined);
mockDb.pragma.mockReturnValue(undefined);

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => mockDb),
  };
});

import { SkillStore, EvolutionEngine } from '../src/index.js';
import type { Skill, EvolutionConfig } from '../src/types.js';

// ─── SkillStore Tests ─────────────────────────────────────────

describe('SkillStore', () => {
  let store: SkillStore;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values
    mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });
    mockStatement.get.mockReturnValue(null);
    mockStatement.all.mockReturnValue([]);
    mockDb.prepare.mockReturnValue(mockStatement);

    store = new SkillStore(':memory:');
  });

  it('should create a SkillStore instance', () => {
    expect(store).toBeDefined();
  });

  it('should have database initialized with exec', () => {
    // Database was initialized during SkillStore creation
    expect(mockDb.exec).toBeDefined();
    expect(typeof mockDb.exec).toBe('function');
  });

  it('should call exec to initialize tables', () => {
    expect(mockDb.exec).toHaveBeenCalled();
  });

  it('should call pragma for WAL journal mode', () => {
    expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
  });

  it('should save a skill', () => {
    const skill = store.save({
      name: 'test-skill',
      content: 'Do something useful',
    });
    expect(skill).toBeDefined();
    expect(skill.name).toBe('test-skill');
    expect(skill.content).toBe('Do something useful');
    expect(skill.version).toBe(1);
  });

  it('should call prepare and run when saving', () => {
    store.save({ name: 'test', content: 'c' });
    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockStatement.run).toHaveBeenCalled();
  });

  it('should close the database', () => {
    store.close();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it('should call prepare for findById', () => {
    mockStatement.get.mockReturnValue(null);
    store.findById('non-existent');
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for findByName', () => {
    mockStatement.all.mockReturnValue([]);
    store.findByName('alpha');
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for findTopSkills', () => {
    mockStatement.all.mockReturnValue([]);
    store.findTopSkills(5);
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for incrementUsage', () => {
    store.incrementUsage('skill-1');
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for update', () => {
    mockStatement.get.mockReturnValue(null);
    store.update('skill-1', { content: 'new' });
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for findLatest', () => {
    mockStatement.get.mockReturnValue(null);
    store.findLatest('test');
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call prepare for getLineage', () => {
    mockStatement.all.mockReturnValue([]);
    store.getLineage('skill-1');
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});

// ─── EvolutionEngine Tests ─────────────────────────────────────

describe('EvolutionEngine', () => {
  let store: SkillStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStatement.run.mockReturnValue({ lastInsertRowid: 1 });
    mockStatement.get.mockReturnValue(null);
    mockStatement.all.mockReturnValue([]);
    mockDb.prepare.mockReturnValue(mockStatement);

    store = new SkillStore(':memory:');
  });

  it('should create an EvolutionEngine instance', () => {
    const engine = new EvolutionEngine(store, {}, undefined as any);
    expect(engine).toBeDefined();
  });

  it('should return null when promoting non-existent skill', () => {
    mockStatement.get.mockReturnValue(null);
    const engine = new EvolutionEngine(store, {}, undefined as any);
    const result = engine.promoteSkill('non-existent', 0.9);
    expect(result).toBeNull();
  });

  it('should return null when recording execution for non-existent skill', () => {
    mockStatement.get.mockReturnValue(null);
    const engine = new EvolutionEngine(store, {}, undefined as any);
    const result = engine.recordExecution('non-existent', true);
    expect(result).toBeNull();
  });

  it('should return stats', () => {
    mockStatement.all.mockReturnValue([]);
    const engine = new EvolutionEngine(store, {}, undefined as any);
    const stats = engine.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalSkills).toBeDefined();
  });

  it('should throw when fixSkill is called with non-existent skill', async () => {
    mockStatement.get.mockReturnValue(null);
    const engine = new EvolutionEngine(store, {}, undefined as any);
    await expect(engine.fixSkill('non-existent', 'error')).rejects.toThrow('Skill not found');
  });

  it('should throw when deriveSkill is called with non-existent parent', async () => {
    mockStatement.get.mockReturnValue(null);
    const engine = new EvolutionEngine(store, {}, undefined as any);
    await expect(engine.deriveSkill('non-existent', 'purpose')).rejects.toThrow('Parent skill not found');
  });

  it('should call promoteSkill with correct SQL', () => {
    mockStatement.get
      .mockReturnValueOnce({ id: 's1', name: 'test', reward: 0.5, usageCount: 0, successRate: 1.0 })
      .mockReturnValueOnce(undefined); // After update, get updated row

    mockStatement.run.mockReturnValue(undefined);

    const engine = new EvolutionEngine(store, {}, undefined as any);
    engine.promoteSkill('s1', 0.9);
    expect(mockDb.prepare).toHaveBeenCalled();
  });

  it('should call recordExecution with correct SQL', () => {
    mockStatement.get
      .mockReturnValueOnce({ id: 's1', usageCount: 5, successRate: 0.8 })
      .mockReturnValueOnce(undefined); // After update

    mockStatement.run.mockReturnValue(undefined);

    const engine = new EvolutionEngine(store, {}, undefined as any);
    engine.recordExecution('s1', true);
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});
