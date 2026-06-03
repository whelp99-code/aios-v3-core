"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionPipeline = void 0;
const axios_1 = __importDefault(require("axios"));
class IngestionPipeline {
    constructor(store) {
        this.store = store;
    }
    async ingest(source) {
        switch (source.type) {
            case 'skill':
                return [this.ingestSkill(source.data)];
            case 'project':
                return [this.ingestProject(source.data)];
            case 'workflow':
                return this.ingestWorkflow(source.data);
            case 'arxiv':
                return await this.ingestArxiv(source.data);
            case 'github':
                return await this.ingestGitHub(source.data);
            default:
                return [];
        }
    }
    ingestSkill(data) {
        const name = String(data.name ?? 'unknown-skill');
        const node = this.store.addNode({
            id: `skill-${name}`,
            type: 'skill',
            label: name,
            content: String(data.description ?? data.steps ?? ''),
            metadata: { input_schema: data.input_schema, output_schema: data.output_schema },
            source: 'SKILL.md',
            confidence: 0.95,
        });
        if (data.tools && Array.isArray(data.tools)) {
            for (const tool of data.tools) {
                const toolNode = this.store.addNode({
                    id: `tool-${tool}`,
                    type: 'tool',
                    label: tool,
                    content: `Tool referenced by skill ${name}`,
                    metadata: {},
                    confidence: 0.9,
                });
                this.store.addEdge({ sourceId: node.id, targetId: toolNode.id, type: 'depends_on', weight: 1 });
            }
        }
        return node;
    }
    ingestProject(data) {
        return this.store.addNode({
            id: `project-${String(data.id ?? Date.now())}`,
            type: 'project',
            label: String(data.name ?? 'Unnamed Project'),
            content: String(data.summary ?? data.description ?? ''),
            metadata: data,
            source: 'project-memory',
            confidence: 0.85,
        });
    }
    ingestWorkflow(data) {
        const nodes = [];
        const taskNode = this.store.addNode({
            id: `task-${Date.now()}`,
            type: 'task',
            label: String(data.taskInput ?? 'Workflow Task'),
            content: String(data.executionResult ?? data.plan ?? ''),
            metadata: {
                plan: data.plan,
                mcpToolResults: data.mcpToolResults,
                consensusResult: data.consensusResult,
            },
            source: 'orchestrator',
            confidence: 0.9,
        });
        nodes.push(taskNode);
        if (data.knowledgeGraphUpdates && Array.isArray(data.knowledgeGraphUpdates)) {
            for (const update of data.knowledgeGraphUpdates) {
                const n = this.store.upsertFromUpdate(update);
                this.store.addEdge({ sourceId: taskNode.id, targetId: n.id, type: 'derived_from', weight: 0.8 });
                nodes.push(n);
            }
        }
        return nodes;
    }
    async ingestArxiv(data) {
        const query = String(data.query ?? 'agent orchestration');
        try {
            const response = await axios_1.default.get('http://export.arxiv.org/api/query', {
                params: { search_query: `all:${query}`, max_results: 3 },
                timeout: 8000,
            });
            const entries = String(response.data).match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
            return entries.map((entry, i) => {
                const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? `Paper ${i}`;
                const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() ?? '';
                return this.store.addNode({
                    id: `arxiv-${Date.now()}-${i}`,
                    type: 'external',
                    label: title.replace(/\s+/g, ' '),
                    content: summary.replace(/\s+/g, ' ').slice(0, 1000),
                    metadata: { source: 'arxiv', query },
                    source: 'arxiv',
                    confidence: 0.75,
                });
            });
        }
        catch {
            return [
                this.store.addNode({
                    id: `arxiv-sim-${Date.now()}`,
                    type: 'external',
                    label: `Simulated arXiv: ${query}`,
                    content: `Research on ${query} - simulated ingestion (network unavailable)`,
                    metadata: { source: 'arxiv', mode: 'simulated' },
                    source: 'arxiv',
                    confidence: 0.5,
                }),
            ];
        }
    }
    async ingestGitHub(data) {
        const repo = String(data.repo ?? 'langchain-ai/langgraph');
        try {
            const response = await axios_1.default.get(`https://api.github.com/repos/${repo}`, {
                timeout: 8000,
                headers: { Accept: 'application/vnd.github.v3+json' },
            });
            const d = response.data;
            return [
                this.store.addNode({
                    id: `github-${repo.replace('/', '-')}`,
                    type: 'external',
                    label: d.full_name,
                    content: `${d.description ?? ''}\nStars: ${d.stargazers_count}\nLanguage: ${d.language}`,
                    metadata: { url: d.html_url, stars: d.stargazers_count },
                    source: 'github',
                    confidence: 0.85,
                }),
            ];
        }
        catch {
            return [
                this.store.addNode({
                    id: `github-sim-${Date.now()}`,
                    type: 'external',
                    label: `Simulated GitHub: ${repo}`,
                    content: `Repository ${repo} - simulated ingestion`,
                    metadata: { source: 'github', mode: 'simulated' },
                    source: 'github',
                    confidence: 0.5,
                }),
            ];
        }
    }
}
exports.IngestionPipeline = IngestionPipeline;
//# sourceMappingURL=ingestion-pipeline.js.map