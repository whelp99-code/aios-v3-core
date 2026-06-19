"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_CONTRACT = exports.CommunityRegistry = exports.WebhookPublisher = exports.PluginManager = exports.AIOS = void 0;
const path_1 = __importDefault(require("path"));
const ai_core_1 = require("@aios/ai-core");
const aios_knowledge_graph_1 = require("aios-knowledge-graph");
const aios_mcp_adapters_1 = require("aios-mcp-adapters");
const aios_orchestrator_1 = require("aios-orchestrator");
const self_evolution_1 = require("@aios/self-evolution");
const plugin_manager_1 = require("./plugin-manager");
const webhook_publisher_1 = require("./webhook-publisher");
const community_registry_1 = require("./community-registry");
class AIOS {
    constructor(config = {}) {
        this.config = config;
        const dataDir = config.dataDir ?? path_1.default.resolve(process.cwd(), 'data');
        const client = new ai_core_1.LMStudioClient({
            baseURL: config.lmStudioBaseURL ?? 'http://localhost:1234/v1',
            timeout: 60000,
        });
        this.dynamicRouter = new ai_core_1.DynamicRouter({
            lmStudioClient: client,
            openaiApiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY,
            anthropicApiKey: config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
            huggingfaceApiKey: config.huggingfaceApiKey ??
                process.env.HF_TOKEN ??
                process.env.HUGGINGFACE_API_KEY,
            mimoApiKey: config.mimoApiKey ?? process.env.MIMO_API_KEY,
            mimoBaseURL: config.mimoBaseURL,
            mimoProvider: config.mimoProvider,
            preferences: {
                mode: config.engineMode ?? 'auto',
                ...config.enginePreferences,
            },
        });
        const modelRouter = new ai_core_1.ModelRouter(client, undefined, this.dynamicRouter);
        this.knowledge = new aios_knowledge_graph_1.OpenKB(path_1.default.join(dataDir, 'knowledge'));
        this.evolution = new self_evolution_1.EvolutionKernel(path_1.default.join(dataDir, 'learned'));
        this.plugins = new plugin_manager_1.PluginManager();
        this.webhooks = new webhook_publisher_1.WebhookPublisher();
        this.community = new community_registry_1.CommunityRegistry();
        this.mcp = new aios_mcp_adapters_1.MCPRegistry(config.mcp ?? {});
        this.orchestrator = new aios_orchestrator_1.Orchestrator(client, modelRouter, new aios_orchestrator_1.SkillParser(), {
            maxIterations: config.maxIterations ?? 10,
            skillsDirectory: config.skillsDirectory,
            mcpRegistry: this.mcp,
            knowledgeGraph: this.knowledge,
            evolutionKernel: this.evolution,
            engineMode: config.engineMode ?? 'auto',
            parallelExecution: config.parallelExecution ?? true,
        });
        this.plugins.setEventEmitter((event, data) => {
            this.webhooks.publish(event, data).catch(() => { });
        });
        this.applyLearnedPolicy();
    }
    applyLearnedPolicy() {
        const policy = this.evolution.policyStore.get();
        const preferred = policy.routingBias.preferredProvider;
        if (preferred && preferred !== 'local') {
            this.dynamicRouter.setPreferences({
                preferredCloudProvider: preferred,
                mode: this.getEnginePreferences().mode,
            });
        }
    }
    async runTraining(options = {}) {
        const dataset = options.dataset ?? 'databricks/databricks-dolly-15k';
        const report = await this.evolution.training.runFullLoop({
            dataset,
            iterations: options.iterations ?? 10,
            dataDir: path_1.default.join(this.config.dataDir ?? path_1.default.resolve(process.cwd(), 'data'), 'learned'),
            ingestSample: async (sample, iteration) => {
                await this.knowledge.ingestion.ingest({
                    type: 'dataset',
                    data: {
                        instruction: sample.instruction,
                        response: sample.review,
                        success: sample.success,
                        reward: sample.reward,
                        category: sample.category,
                        iteration,
                        dataset,
                        rowIdx: sample.rowIdx,
                    },
                });
            },
        });
        this.applyLearnedPolicy();
        await this.webhooks.publish('training.completed', {
            iterations: report.iterations.length,
            totalSamples: report.totalSamples,
            finalSuccessRate: report.finalSuccessRate,
            policyVersion: report.finalPolicy.version,
        });
        return report;
    }
    setEnginePreferences(prefs) {
        this.dynamicRouter.setPreferences(prefs);
    }
    getEnginePreferences() {
        return this.dynamicRouter.getPreferences();
    }
    async getEngineStatus() {
        const health = await this.dynamicRouter.getAllProviderHealth();
        const snapshot = await this.dynamicRouter.getResourceSnapshot();
        const models = this.dynamicRouter.registry.getAll();
        return { health, snapshot, models, preferences: this.getEnginePreferences() };
    }
    getOrchestrator() {
        return this.orchestrator;
    }
    async run(taskInput, options = {}) {
        if (options.engineMode) {
            this.dynamicRouter.setPreferences({ mode: options.engineMode });
        }
        const steps = [];
        await this.webhooks.publish('workflow.started', { taskInput, engineMode: options.engineMode });
        const relevantMemories = this.knowledge.memory.recallForTask(taskInput);
        const projectContext = {
            recalledProjects: relevantMemories.map((m) => ({ id: m.projectId, name: m.name, summary: m.summary })),
        };
        const state = await this.orchestrator.run((0, aios_orchestrator_1.createInitialWorkflowState)(taskInput, {
            projectContext,
            engineMode: options.engineMode ?? this.getEnginePreferences().mode,
            parallelExecution: options.parallelExecution ?? this.config.parallelExecution ?? true,
        }), {
            onStep: (step) => {
                steps.push(step);
                options.onStep?.(step);
            },
            userApprovalHandler: options.userApprovalHandler ?? (async () => options.autoApprove !== false),
        });
        await this.knowledge.ingestion.ingest({
            type: 'workflow',
            data: {
                taskInput,
                plan: state.plan,
                executionResult: state.executionResult,
                mcpToolResults: state.mcpToolResults,
                consensusResult: state.consensusResult,
                knowledgeGraphUpdates: state.knowledgeGraphUpdates,
                engineMode: state.engineMode,
            },
        });
        this.knowledge.memory.indexProject(`proj-${Date.now()}`, taskInput.slice(0, 50), this.knowledge.store.getAllNodes().slice(-5).map((n) => n.id), state.lastOutput ?? taskInput);
        this.evolution.experience.add({
            taskInput,
            plan: state.plan,
            executionResult: state.executionResult,
            review: state.review,
            success: state.currentAgent === 'completed',
            reward: state.currentAgent === 'completed' ? 1 : -0.5,
        });
        let evolutionProposalId;
        if (state.review && state.codeChangesProposed?.length) {
            const proposal = await this.evolution.proposals.generate(state.review, state.executionResult, state.codeChangesProposed);
            evolutionProposalId = proposal.id;
            await this.webhooks.publish('evolution.proposal', { proposalId: proposal.id, patches: proposal.patches.length });
        }
        const event = state.currentAgent === 'completed' ? 'workflow.completed' : 'workflow.failed';
        await this.webhooks.publish(event, { taskInput, agent: state.currentAgent });
        return {
            state,
            steps,
            knowledgeNodes: this.knowledge.store.getStats().nodeCount,
            evolutionProposalId,
        };
    }
    queryKnowledge(question) {
        return this.knowledge.rag.query(question);
    }
    validateKnowledge() {
        return this.knowledge.validator.validate();
    }
    getStats() {
        return {
            knowledge: this.knowledge.store.getStats(),
            evolution: {
                experienceSize: this.evolution.experience.size(),
                successRate: this.evolution.experience.getSuccessRate(),
                pendingProposals: this.evolution.hotPatch.getPendingProposals().length,
                appliedPatches: this.evolution.hotPatch.getAppliedPatches().length,
                learnedPolicy: this.evolution.policyStore.get(),
            },
            plugins: this.plugins.getAllPlugins().length,
            webhooks: this.webhooks.getSubscriptions().length,
            community: this.community.list().length,
            mcp: this.mcp.getAllTools().length,
            engine: this.getEnginePreferences(),
        };
    }
}
exports.AIOS = AIOS;
var plugin_manager_2 = require("./plugin-manager");
Object.defineProperty(exports, "PluginManager", { enumerable: true, get: function () { return plugin_manager_2.PluginManager; } });
var webhook_publisher_2 = require("./webhook-publisher");
Object.defineProperty(exports, "WebhookPublisher", { enumerable: true, get: function () { return webhook_publisher_2.WebhookPublisher; } });
var community_registry_2 = require("./community-registry");
Object.defineProperty(exports, "CommunityRegistry", { enumerable: true, get: function () { return community_registry_2.CommunityRegistry; } });
// API Contract
var api_contract_1 = require("./api-contract");
Object.defineProperty(exports, "API_CONTRACT", { enumerable: true, get: function () { return api_contract_1.API_CONTRACT; } });
//# sourceMappingURL=index.js.map