import { KnowledgeEdge, KnowledgeNode } from './types';
export interface KnowledgeGraphSnapshot {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
}
export declare class KnowledgeGraphStore {
    private nodes;
    private edges;
    private persistPath?;
    constructor(persistPath?: string);
    addNode(node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> & Partial<Pick<KnowledgeNode, 'createdAt' | 'updatedAt'>>): KnowledgeNode;
    addEdge(edge: Omit<KnowledgeEdge, 'id'> & {
        id?: string;
    }): KnowledgeEdge;
    getNode(id: string): KnowledgeNode | undefined;
    getAllNodes(): KnowledgeNode[];
    getAllEdges(): KnowledgeEdge[];
    searchNodes(query: string, limit?: number): KnowledgeNode[];
    getNeighbors(nodeId: string): {
        nodes: KnowledgeNode[];
        edges: KnowledgeEdge[];
    };
    upsertFromUpdate(update: {
        type: string;
        content: string;
        source?: string;
    }): KnowledgeNode;
    getSnapshot(): KnowledgeGraphSnapshot;
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        byType: Record<string, number>;
    };
    private persist;
    private load;
}
//# sourceMappingURL=store.d.ts.map