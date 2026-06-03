import { KnowledgeGraphStore } from './store';
import { KnowledgeQueryResult } from './types';
export declare class GraphRAG {
    private store;
    constructor(store: KnowledgeGraphStore);
    query(question: string): KnowledgeQueryResult;
}
//# sourceMappingURL=graph-rag.d.ts.map