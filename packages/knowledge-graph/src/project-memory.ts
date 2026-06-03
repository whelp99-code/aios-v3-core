import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeGraphStore } from './store';
import { ProjectMemory } from './types';

export class ProjectMemoryIndexer {
  private memories = new Map<string, ProjectMemory>();
  private persistPath?: string;

  constructor(private store: KnowledgeGraphStore, persistPath?: string) {
    this.persistPath = persistPath;
    if (persistPath && fs.existsSync(persistPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(persistPath, 'utf-8')) as ProjectMemory[];
        for (const m of data) this.memories.set(m.projectId, m);
      } catch {
        // fresh start
      }
    }
  }

  indexProject(projectId: string, name: string, nodeIds: string[], summary: string): ProjectMemory {
    const memory: ProjectMemory = {
      projectId,
      name,
      nodeIds,
      lastAccessed: new Date().toISOString(),
      summary,
    };
    this.memories.set(projectId, memory);
    this.persist();
    return memory;
  }

  getProject(projectId: string): ProjectMemory | undefined {
    return this.memories.get(projectId);
  }

  getAllProjects(): ProjectMemory[] {
    return Array.from(this.memories.values()).sort(
      (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
  }

  recallForTask(taskInput: string, limit = 5): ProjectMemory[] {
    const q = taskInput.toLowerCase();
    return this.getAllProjects()
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          q.split(/\s+/).some((w) => w.length > 3 && m.summary.toLowerCase().includes(w))
      )
      .slice(0, limit);
  }

  getRelatedNodes(projectId: string): string[] {
    return this.memories.get(projectId)?.nodeIds ?? [];
  }

  private persist(): void {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.persistPath, JSON.stringify(this.getAllProjects(), null, 2));
  }
}
