"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeGraphStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class KnowledgeGraphStore {
    constructor(persistPath) {
        this.nodes = new Map();
        this.edges = new Map();
        this.persistPath = persistPath;
        if (persistPath && fs.existsSync(persistPath)) {
            this.load();
        }
    }
    addNode(node) {
        const now = new Date().toISOString();
        const full = {
            createdAt: node.createdAt ?? now,
            updatedAt: now,
            ...node,
        };
        this.nodes.set(full.id, full);
        this.persist();
        return full;
    }
    addEdge(edge) {
        const full = {
            id: edge.id ?? `edge-${edge.sourceId}-${edge.targetId}-${Date.now()}`,
            ...edge,
        };
        this.edges.set(full.id, full);
        this.persist();
        return full;
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getAllEdges() {
        return Array.from(this.edges.values());
    }
    searchNodes(query, limit = 20) {
        const q = query.toLowerCase();
        return this.getAllNodes()
            .filter((n) => n.label.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.type.includes(q))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }
    getNeighbors(nodeId) {
        const relatedEdges = this.getAllEdges().filter((e) => e.sourceId === nodeId || e.targetId === nodeId);
        const neighborIds = new Set();
        for (const e of relatedEdges) {
            neighborIds.add(e.sourceId === nodeId ? e.targetId : e.sourceId);
        }
        const nodes = Array.from(neighborIds)
            .map((id) => this.getNode(id))
            .filter((n) => n !== undefined);
        return { nodes, edges: relatedEdges };
    }
    upsertFromUpdate(update) {
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
    getSnapshot() {
        return { nodes: this.getAllNodes(), edges: this.getAllEdges() };
    }
    getStats() {
        const nodes = this.getAllNodes();
        const byType = {};
        for (const n of nodes) {
            byType[n.type] = (byType[n.type] ?? 0) + 1;
        }
        return {
            nodeCount: nodes.length,
            edgeCount: this.getAllEdges().length,
            byType,
        };
    }
    persist() {
        if (!this.persistPath)
            return;
        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.persistPath, JSON.stringify(this.getSnapshot(), null, 2));
    }
    load() {
        if (!this.persistPath)
            return;
        try {
            const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
            for (const node of data.nodes)
                this.nodes.set(node.id, node);
            for (const edge of data.edges)
                this.edges.set(edge.id, edge);
        }
        catch {
            // start fresh
        }
    }
}
exports.KnowledgeGraphStore = KnowledgeGraphStore;
//# sourceMappingURL=store.js.map