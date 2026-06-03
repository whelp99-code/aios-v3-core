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
exports.ProjectMemoryIndexer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProjectMemoryIndexer {
    constructor(store, persistPath) {
        this.store = store;
        this.memories = new Map();
        this.persistPath = persistPath;
        if (persistPath && fs.existsSync(persistPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(persistPath, 'utf-8'));
                for (const m of data)
                    this.memories.set(m.projectId, m);
            }
            catch {
                // fresh start
            }
        }
    }
    indexProject(projectId, name, nodeIds, summary) {
        const memory = {
            projectId,
            name,
            nodeIds,
            lastAccessed: new Date().toISOString(),
            summary,
        };
        this.memories.set(projectId, memory);
        this.persist();
        return memory;
    }
    getProject(projectId) {
        return this.memories.get(projectId);
    }
    getAllProjects() {
        return Array.from(this.memories.values()).sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
    }
    recallForTask(taskInput, limit = 5) {
        const q = taskInput.toLowerCase();
        return this.getAllProjects()
            .filter((m) => m.name.toLowerCase().includes(q) ||
            m.summary.toLowerCase().includes(q) ||
            q.split(/\s+/).some((w) => w.length > 3 && m.summary.toLowerCase().includes(w)))
            .slice(0, limit);
    }
    getRelatedNodes(projectId) {
        return this.memories.get(projectId)?.nodeIds ?? [];
    }
    persist() {
        if (!this.persistPath)
            return;
        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.persistPath, JSON.stringify(this.getAllProjects(), null, 2));
    }
}
exports.ProjectMemoryIndexer = ProjectMemoryIndexer;
//# sourceMappingURL=project-memory.js.map