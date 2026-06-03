import { GraphRAG } from './graph-rag';
import { IngestionPipeline } from './ingestion-pipeline';
import { ProjectMemoryIndexer } from './project-memory';
import { KnowledgeGraphStore } from './store';
import { KnowledgeValidator } from './validator';

export { KnowledgeGraphStore, type KnowledgeGraphSnapshot } from './store';
export { IngestionPipeline } from './ingestion-pipeline';
export { KnowledgeValidator } from './validator';
export { ProjectMemoryIndexer } from './project-memory';
export { GraphRAG } from './graph-rag';
export type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeQueryResult,
  IngestionSource,
  ValidationIssue,
  ProjectMemory,
  NodeType,
  EdgeType,
} from './types';

export class OpenKB {
  store: KnowledgeGraphStore;
  ingestion: IngestionPipeline;
  validator: KnowledgeValidator;
  memory: ProjectMemoryIndexer;
  rag: GraphRAG;

  constructor(dataDir?: string) {
    const base = dataDir ?? './data/knowledge';
    this.store = new KnowledgeGraphStore(`${base}/graph.json`);
    this.ingestion = new IngestionPipeline(this.store);
    this.validator = new KnowledgeValidator(this.store);
    this.memory = new ProjectMemoryIndexer(this.store, `${base}/projects.json`);
    this.rag = new GraphRAG(this.store);
  }
}
