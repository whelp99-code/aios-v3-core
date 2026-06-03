import { KnowledgeGraphStore } from './store';
import { IngestionSource, KnowledgeNode } from './types';
export declare class IngestionPipeline {
    private store;
    constructor(store: KnowledgeGraphStore);
    ingest(source: IngestionSource): Promise<KnowledgeNode[]>;
    ingestSkill(data: Record<string, unknown>): KnowledgeNode;
    ingestProject(data: Record<string, unknown>): KnowledgeNode;
    ingestWorkflow(data: Record<string, unknown>): KnowledgeNode[];
    ingestArxiv(data: Record<string, unknown>): Promise<KnowledgeNode[]>;
    ingestGitHub(data: Record<string, unknown>): Promise<KnowledgeNode[]>;
}
//# sourceMappingURL=ingestion-pipeline.d.ts.map