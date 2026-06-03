import path from 'path';
import { RapidMLXClient, ModelRouter } from '@aios/ai-core';
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
  dataDir?: string;
  skillsDirectory?: string;
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

  private orchestrator: Orchestrator;
  private config: AIOSConfig;

  constructor(config: AIOSConfig = {}) {
    this.config = config;
    const dataDir = config.dataDir ?? path.resolve(process.cwd(), 'data');
    const client = new RapidMLXClient({
      baseURL: config.rapidMLXBaseURL ?? 'http://localhost:8000/v1',
      timeout: 60000,
    });

    this.knowledge = new OpenKB(path.join(dataDir, 'knowledge'));
    this.evolution = new EvolutionKernel();
    this.plugins = new PluginManager();
    this.webhooks = new WebhookPublisher();
    this.community = new CommunityRegistry();
    this.mcp = new MCPRegistry(config.mcp ?? {});

    this.orchestrator = new Orchestrator(
      client,
      new ModelRouter(client),
      new SkillParser(),
      {
        maxIterations: config.maxIterations ?? 10,
        skillsDirectory: config.skillsDirectory,
        mcpRegistry: this.mcp,
        knowledgeGraph: this.knowledge,
        evolutionKernel: this.evolution,
      }
    );

    this.plugins.setEventEmitter((event, data) => {
      this.webhooks.publish(event as WebhookEvent, data as Record<string, unknown>).catch(() => {});
    });
  }

  getOrchestrator(): Orchestrator {
    return this.orchestrator;
  }

  async run(
    taskInput: string,
    options: {
      autoApprove?: boolean;
      onStep?: (step: WorkflowStepEvent) => void;
      userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
    } = {}
  ): Promise<AIOSRunResult> {
    const steps: WorkflowStepEvent[] = [];

    await this.webhooks.publish('workflow.started', { taskInput });

    const relevantMemories = this.knowledge.memory.recallForTask(taskInput);
    const projectContext: Record<string, unknown> = {
      recalledProjects: relevantMemories.map((m) => ({ id: m.projectId, name: m.name, summary: m.summary })),
    };

    const state = await this.orchestrator.run(
      createInitialWorkflowState(taskInput, { projectContext }),
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
      },
    });

    this.knowledge.memory.indexProject(
      `proj-${Date.now()}`,
      taskInput.slice(0, 50),
      this.knowledge.store.getAllNodes().slice(-5).map((n) => n.id),
      state.lastOutput ?? taskInput
    );

    this.evolution.experience.add({
      taskInput,
      plan: state.plan,
      executionResult: state.executionResult,
      review: state.review,
      success: state.currentAgent === 'completed',
      reward: state.currentAgent === 'completed' ? 1 : -0.5,
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
      },
      plugins: this.plugins.getAllPlugins().length,
      webhooks: this.webhooks.getSubscriptions().length,
      community: this.community.list().length,
      mcp: this.mcp.getAllTools().length,
    };
  }
}

export { PluginManager, type AIOSPlugin } from './plugin-manager';
export { WebhookPublisher, type WebhookEvent, type WebhookSubscription } from './webhook-publisher';
export { CommunityRegistry, type CommunityContribution } from './community-registry';
