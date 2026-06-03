import { KnowledgeGraphStore } from './store';
import { ValidationIssue } from './types';

export class KnowledgeValidator {
  constructor(private store: KnowledgeGraphStore) {}

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const nodes = this.store.getAllNodes();
    const edges = this.store.getAllEdges();
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const node of nodes) {
      if (!node.label.trim()) {
        issues.push({
          nodeId: node.id,
          severity: 'error',
          message: 'Node has empty label',
          autoFixable: true,
        });
      }
      if (node.confidence < 0.3) {
        issues.push({
          nodeId: node.id,
          severity: 'warning',
          message: `Low confidence score: ${node.confidence}`,
          autoFixable: false,
        });
      }
      if (node.content.length < 10) {
        issues.push({
          nodeId: node.id,
          severity: 'warning',
          message: 'Node content is too short',
          autoFixable: false,
        });
      }
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.sourceId)) {
        issues.push({
          nodeId: edge.sourceId,
          severity: 'error',
          message: `Edge references missing source node: ${edge.sourceId}`,
          autoFixable: true,
        });
      }
      if (!nodeIds.has(edge.targetId)) {
        issues.push({
          nodeId: edge.targetId,
          severity: 'error',
          message: `Edge references missing target node: ${edge.targetId}`,
          autoFixable: true,
        });
      }
    }

    return issues;
  }

  autoFix(issues: ValidationIssue[]): number {
    let fixed = 0;
    for (const issue of issues.filter((i) => i.autoFixable)) {
      const node = this.store.getNode(issue.nodeId);
      if (node && !node.label.trim()) {
        this.store.addNode({ ...node, label: `Node ${node.id.slice(0, 8)}` });
        fixed++;
      }
    }
    return fixed;
  }
}
