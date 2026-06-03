export type NodeType = 'skill' | 'concept' | 'document' | 'project' | 'tool' | 'task' | 'external';
export type EdgeType = 'references' | 'depends_on' | 'derived_from' | 'related_to' | 'executed_with';

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  label: string;
  content: string;
  metadata: Record<string, unknown>;
  source?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeQueryResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  answer: string;
  confidence: number;
}

export interface IngestionSource {
  type: 'skill' | 'arxiv' | 'github' | 'project' | 'workflow';
  data: Record<string, unknown>;
}

export interface ValidationIssue {
  nodeId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  autoFixable: boolean;
}

export interface ProjectMemory {
  projectId: string;
  name: string;
  nodeIds: string[];
  lastAccessed: string;
  summary: string;
}
