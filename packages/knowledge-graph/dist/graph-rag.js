"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRAG = void 0;
class GraphRAG {
    constructor(store) {
        this.store = store;
    }
    query(question) {
        const relevantNodes = this.store.searchNodes(question, 10);
        const edges = this.store.getAllEdges().filter((e) => relevantNodes.some((n) => n.id === e.sourceId) ||
            relevantNodes.some((n) => n.id === e.targetId));
        const contextParts = relevantNodes.map((n) => `[${n.type}] ${n.label}: ${n.content.slice(0, 200)}`);
        const answer = relevantNodes.length > 0
            ? `Based on ${relevantNodes.length} knowledge nodes:\n${contextParts.join('\n')}`
            : 'No relevant knowledge found in the graph.';
        const avgConfidence = relevantNodes.length > 0
            ? relevantNodes.reduce((s, n) => s + n.confidence, 0) / relevantNodes.length
            : 0;
        return {
            nodes: relevantNodes,
            edges,
            answer,
            confidence: avgConfidence,
        };
    }
}
exports.GraphRAG = GraphRAG;
//# sourceMappingURL=graph-rag.js.map