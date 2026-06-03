import { KnowledgeGraphStore } from './store';
import { ProjectMemory } from './types';
export declare class ProjectMemoryIndexer {
    private store;
    private memories;
    private persistPath?;
    constructor(store: KnowledgeGraphStore, persistPath?: string);
    indexProject(projectId: string, name: string, nodeIds: string[], summary: string): ProjectMemory;
    getProject(projectId: string): ProjectMemory | undefined;
    getAllProjects(): ProjectMemory[];
    recallForTask(taskInput: string, limit?: number): ProjectMemory[];
    getRelatedNodes(projectId: string): string[];
    private persist;
}
//# sourceMappingURL=project-memory.d.ts.map