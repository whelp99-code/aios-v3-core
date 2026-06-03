import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeEdge, KnowledgeNode } from './types';

export interface KnowledgeGraphSnapshot {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export class KnowledgeGraphStore {
  private nodes = new Map<string, KnowledgeNode>();
  private edges = new Map<string, KnowledgeEdge>();
  private persistPath?: string;

  constructor(persistPath?: string) {
    this.persistPath = persistPath;
    if (persistPath && fs.existsSync(persistPath)) {
      this.load();
    }
  }

  addNode(node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> & Partial<Pick<KnowledgeNode, 'createdAt' | 'updatedAt'>>): KnowledgeNode {
    const now = new Date().toISOString();
    const full: KnowledgeNode = {
      createdAt: node.createdAt ?? now,
      updatedAt: now,
      ...node,
    };
    this.nodes.set(full.id, full);
    this.persist();
    return full;
  }

  addEdge(edge: Omit<KnowledgeEdge, 'id'> & { id?: string }): KnowledgeEdge {
    const full: KnowledgeEdge = {
      id: edge.id ?? `edge-${edge.sourceId}-${edge.targetId}-${Date.now()}`,
      ...edge,
    };
    this.edges.set(full.id, full);
    this.persist();
    return full;
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): KnowledgeEdge[] {
    return Array.from(this.edges.values());
  }

  searchNodes(query: string, limit = 20): KnowledgeNode[] {
    const q = query.toLowerCase();
    return this.getAllNodes()
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.type.includes(q)
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  getNeighbors(nodeId: string): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const relatedEdges = this.getAllEdges().filter(
      (e) => e.sourceId === nodeId || e.targetId === nodeId
    );
    const neighborIds = new Set<string>();
    for (const e of relatedEdges) {
      neighborIds.add(e.sourceId === nodeId ? e.targetId : e.sourceId);
    }
    const nodes = Array.from(neighborIds)
      .map((id) => this.getNode(id))
      .filter((n): n is KnowledgeNode => n !== undefined);
    return { nodes, edges: relatedEdges };
  }

  upsertFromUpdate(update: { type: string; content: string; source?: string }): KnowledgeNode {
    const id = `node-${update.type}-${Date.now()}`;
    return this.addNode({
      id,
      type: update.type.includes('skill') ? 'skill' : update.type.includes('code') ? 'concept' : 'task',
      label: update.content.slice(0, 80),
      content: update.content,
      metadata: { source: update.source },
      source: update.source,
      confidence: 0.8,
    });
  }

  getSnapshot(): KnowledgeGraphSnapshot {
    return { nodes: this.getAllNodes(), edges: this.getAllEdges() };
  }

  getStats() {
    const nodes = this.getAllNodes();
    const byType: Record<string, number> = {};
    for (const n of nodes) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }
    return {
      nodeCount: nodes.length,
      edgeCount: this.getAllEdges().length,
      byType,
    };
  }

  private persist(): void {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.persistPath, JSON.stringify(this.getSnapshot(), null, 2));
  }

  private load(): void {
    if (!this.persistPath) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8')) as KnowledgeGraphSnapshot;
      for (const node of data.nodes) this.nodes.set(node.id, node);
      for (const edge of data.edges) this.edges.set(edge.id, edge);
    } catch {
      // start fresh
    }
  }
}
