import path from 'path';
import {
  RapidMLXClient,
  ModelRouter,
  DynamicRouter,
  type EngineMode,
  type EnginePreferences,
} from '@aios/ai-core';
import { OpenKB } from '@aios/knowledge-graph';
import { MCPRegistry } from '@aios/mcp-adapters';
import {
  Orchestrator,
  SkillParser,
  createInitialWorkflowState,
  type AgentWorkflowState,
  type WorkflowStepEvent,
} from '@aios/orchestrator';
import { EvolutionKernel } from '@aios/self-evolution';
import { PluginManager } from './plugin-manager';
import { WebhookEvent, WebhookPublisher } from './webhook-publisher';
import { CommunityRegistry } from './community-registry';

export interface AIOSConfig {
  rapidMLXBaseURL?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  huggingfaceApiKey?: string;
  dataDir?: string;
  skillsDirectory?: string;
  engineMode?: EngineMode;
  enginePreferences?: EnginePreferences;
  parallelExecution?: boolean;
  mcp?: {
    vibeCodingOSUrl?: string;
    automationPortalUrl?: string;
    revenueOpsUrl?: string;
  };
  maxIterations?: number;
}

export interface AIOSRunResult {
  state: AgentWorkflowState;
  steps: WorkflowStepEvent[];
  knowledgeNodes: number;
  evolutionProposalId?: string;
}

export class AIOS {
  readonly knowledge: OpenKB;
  readonly evolution: EvolutionKernel;
  readonly plugins: PluginManager;
  readonly webhooks: WebhookPublisher;
  readonly mcp: MCPRegistry;
  readonly community: CommunityRegistry;
  readonly dynamicRouter: DynamicRouter;

  private orchestrator: Orchestrator;
  private config: AIOSConfig;

  constructor(config: AIOSConfig = {}) {
    this.config = config;
    const dataDir = config.dataDir ?? path.resolve(process.cwd(), 'data');
    const client = new RapidMLXClient({
      baseURL: config.rapidMLXBaseURL ?? 'http://localhost:8000/v1',
      timeout: 60000,
    });

    this.dynamicRouter = new DynamicRouter({
      rapidMLXClient: client,
      openaiApiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY,
      anthropicApiKey: config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      huggingfaceApiKey:
        config.huggingfaceApiKey ??
        process.env.HF_TOKEN ??
        process.env.HUGGINGFACE_API_KEY,
      preferences: {
        mode: config.engineMode ?? 'auto',
        ...config.enginePreferences,
      },
    });

    const modelRouter = new ModelRouter(client, undefined, this.dynamicRouter);

    this.knowledge = new OpenKB(path.join(dataDir, 'knowledge'));
    this.evolution = new EvolutionKernel(path.join(dataDir, 'learned'));
    this.plugins = new PluginManager();
    this.webhooks = new WebhookPublisher();
    this.community = new CommunityRegistry();
    this.mcp = new MCPRegistry(config.mcp ?? {});

    this.orchestrator = new Orchestrator(
      client,
      modelRouter,
      new SkillParser(),
      {
        maxIterations: config.maxIterations ?? 10,
        skillsDirectory: config.skillsDirectory,
        mcpRegistry: this.mcp,
        knowledgeGraph: this.knowledge,
        evolutionKernel: this.evolution,
        engineMode: config.engineMode ?? 'auto',
        parallelExecution: config.parallelExecution ?? true,
      }
    );

    this.plugins.setEventEmitter((event, data) => {
      this.webhooks.publish(event as WebhookEvent, data as Record<string, unknown>).catch(() => {});
    });

    this.applyLearnedPolicy();
  }

  private applyLearnedPolicy(): void {
    const policy = this.evolution.policyStore.get();
    const bridged = this.evolution.policyBridge.apply(policy, this.getEnginePreferences());
    this.dynamicRouter.setPreferences(bridged.enginePreferences);
  }

  async runOperationalLearning(iterations = 1000) {
    const dataDir = path.join(this.config.dataDir ?? path.resolve(process.cwd(), 'data'), 'learned');
    const report = await this.evolution.operational.runLoop(iterations);
    this.applyLearnedPolicy();
    await this.webhooks.publish('training.completed', {
      mode: 'operational',
      iterations: report.iterations,
      goldenSetSuccessRate: report.goldenSetSuccessRate,
      policyVersion: report.policy.version,
    });
    return report;
  }

  async runTraining(options: {
    dataset?: string;
    datasets?: Array<string | { id: string; config?: string; split?: string; domain?: string }>;
    iterations?: number;
    policyFile?: string;
    resetCursors?: boolean;
  } = {}) {
    const dataDir = path.join(this.config.dataDir ?? path.resolve(process.cwd(), 'data'), 'learned');
    const entries = options.datasets?.length
      ? options.datasets
      : options.dataset
        ? [options.dataset]
        : undefined;

    if (options.resetCursors && this.evolution.training.cursorStore) {
      this.evolution.training.cursorStore.reset();
    }

    const report = await this.evolution.training.runFullLoop({
      dataset: options.dataset,
      datasets: entries,
      iterations: options.iterations ?? 10,
      dataDir,
      policyFile: options.policyFile,
      ingestSample: async (sample, iteration, datasetId) => {
        const list = entries ?? [options.dataset ?? 'unknown'];
        const idx = (iteration - 1) % list.length;
        const entry = list[idx];
        const ds =
          datasetId ??
          (typeof entry === 'string' ? entry : entry?.id) ??
          options.dataset ??
          'unknown';
        const domain = typeof entry === 'object' && entry && 'domain' in entry ? entry.domain : undefined;
        await this.knowledge.ingestion.ingest({
          type: 'dataset',
          data: {
            instruction: sample.instruction,
            response: sample.review,
            success: sample.success,
            reward: sample.reward,
            category: sample.category,
            iteration,
            dataset: ds,
            domain,
            hfRowIdx: sample.rowIdx,
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

  setEnginePreferences(prefs: Partial<EnginePreferences>): void {
    this.dynamicRouter.setPreferences(prefs);
  }

  getEnginePreferences(): EnginePreferences {
    return this.dynamicRouter.getPreferences();
  }

  async getEngineStatus() {
    const health = await this.dynamicRouter.getAllProviderHealth();
    const snapshot = await this.dynamicRouter.getResourceSnapshot();
    const models = this.dynamicRouter.registry.getAll();
    return { health, snapshot, models, preferences: this.getEnginePreferences() };
  }

  getOrchestrator(): Orchestrator {
    return this.orchestrator;
  }

  async run(
    taskInput: string,
    options: {
      autoApprove?: boolean;
      engineMode?: EngineMode;
      parallelExecution?: boolean;
      onStep?: (step: WorkflowStepEvent) => void;
      userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
    } = {}
  ): Promise<AIOSRunResult> {
    if (options.engineMode) {
      this.dynamicRouter.setPreferences({ mode: options.engineMode });
    }

    const steps: WorkflowStepEvent[] = [];

    await this.webhooks.publish('workflow.started', { taskInput, engineMode: options.engineMode });

    const relevantMemories = this.knowledge.memory.recallForTask(taskInput);
    const projectContext: Record<string, unknown> = {
      recalledProjects: relevantMemories.map((m) => ({ id: m.projectId, name: m.name, summary: m.summary })),
    };

    const state = await this.orchestrator.run(
      createInitialWorkflowState(taskInput, {
        projectContext,
        engineMode: options.engineMode ?? this.getEnginePreferences().mode,
        parallelExecution: options.parallelExecution ?? this.config.parallelExecution ?? true,
      }),
      {
        onStep: (step) => {
          steps.push(step);
          options.onStep?.(step);
        },
        userApprovalHandler: options.userApprovalHandler ?? (async () => options.autoApprove !== false),
      }
    );

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

    this.knowledge.memory.indexProject(
      `proj-${Date.now()}`,
      taskInput.slice(0, 50),
      this.knowledge.store.getAllNodes().slice(-5).map((n) => n.id),
      state.lastOutput ?? taskInput
    );

    const workflowSuccess = state.currentAgent === 'completed';
    const consensusVerdict = state.consensusResult?.verdict as
      | 'APPROVED'
      | 'NEEDS_CORRECTION'
      | 'NEEDS_APPROVAL'
      | undefined;

    this.evolution.telemetry.append({
      taskInput,
      plan: state.plan,
      executionResult: state.executionResult,
      review: state.review,
      success: workflowSuccess,
      reward: workflowSuccess ? 1 : -0.5,
      source: 'workflow',
      consensusVerdict: consensusVerdict ?? (workflowSuccess ? 'APPROVED' : 'FAILED'),
      metadata: { engineMode: state.engineMode, agent: state.currentAgent },
    });

    this.evolution.experience.add({
      taskInput,
      plan: state.plan,
      executionResult: state.executionResult,
      review: state.review,
      success: workflowSuccess,
      reward: workflowSuccess ? 1 : -0.5,
      metadata: { source: 'workflow' },
    });

    let evolutionProposalId: string | undefined;
    if (state.review && state.codeChangesProposed?.length) {
      const proposal = await this.evolution.proposals.generate(
        state.review,
        state.executionResult,
        state.codeChangesProposed
      );
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

  queryKnowledge(question: string) {
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

export { PluginManager, type AIOSPlugin } from './plugin-manager';
export { WebhookPublisher, type WebhookEvent, type WebhookSubscription } from './webhook-publisher';
export { CommunityRegistry, type CommunityContribution } from './community-registry';
