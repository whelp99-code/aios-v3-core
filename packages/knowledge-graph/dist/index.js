"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenKB = exports.GraphRAG = exports.ProjectMemoryIndexer = exports.KnowledgeValidator = exports.IngestionPipeline = exports.KnowledgeGraphStore = void 0;
const graph_rag_1 = require("./graph-rag");
const ingestion_pipeline_1 = require("./ingestion-pipeline");
const project_memory_1 = require("./project-memory");
const store_1 = require("./store");
const validator_1 = require("./validator");
var store_2 = require("./store");
Object.defineProperty(exports, "KnowledgeGraphStore", { enumerable: true, get: function () { return store_2.KnowledgeGraphStore; } });
var ingestion_pipeline_2 = require("./ingestion-pipeline");
Object.defineProperty(exports, "IngestionPipeline", { enumerable: true, get: function () { return ingestion_pipeline_2.IngestionPipeline; } });
var validator_2 = require("./validator");
Object.defineProperty(exports, "KnowledgeValidator", { enumerable: true, get: function () { return validator_2.KnowledgeValidator; } });
var project_memory_2 = require("./project-memory");
Object.defineProperty(exports, "ProjectMemoryIndexer", { enumerable: true, get: function () { return project_memory_2.ProjectMemoryIndexer; } });
var graph_rag_2 = require("./graph-rag");
Object.defineProperty(exports, "GraphRAG", { enumerable: true, get: function () { return graph_rag_2.GraphRAG; } });
class OpenKB {
    constructor(dataDir) {
        const base = dataDir ?? './data/knowledge';
        this.store = new store_1.KnowledgeGraphStore(`${base}/graph.json`);
        this.ingestion = new ingestion_pipeline_1.IngestionPipeline(this.store);
        this.validator = new validator_1.KnowledgeValidator(this.store);
        this.memory = new project_memory_1.ProjectMemoryIndexer(this.store, `${base}/projects.json`);
        this.rag = new graph_rag_1.GraphRAG(this.store);
    }
}
exports.OpenKB = OpenKB;
//# sourceMappingURL=index.js.map