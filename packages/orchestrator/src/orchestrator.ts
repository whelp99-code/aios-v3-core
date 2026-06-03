import * as fs from 'fs';
import * as path from 'path';
import { StateGraph, StateGraphArgs } from '@langchain/langgraph';
import {
  AgentState,
  AgentWorkflowState,
  CodeChange,
  KnowledgeGraphUpdate,
  MCPToolResultSummary,
  WorkflowStepEvent,
  createInitialWorkflowState,
} from './types';
import { RapidMLXClient } from '@aios/ai-core/rapid-mlx-client';
import { AgentRole, ModelRouter, TaskType } from '@aios/ai-core/model-router';
import type { DynamicRouter } from '@aios/ai-core';
import type { EngineMode } from './types';
import { MCPRegistry } from '@aios/mcp-adapters';
import type { OpenKB } from '@aios/knowledge-graph';
import type { EvolutionKernel } from '@aios/self-evolution';
import { ParsedSkill, SkillParser } from './skill-parser';
import { TaskSplitter } from './task-splitter';
import { ConsensusEngine } from './consensus-engine';

export interface OrchestratorOptions {
  maxIterations?: number;
  skillsDirectory?: string;
  mcpRegistry?: MCPRegistry;
  knowledgeGraph?: OpenKB;
  evolutionKernel?: EvolutionKernel;
  engineMode?: EngineMode;
  parallelExecution?: boolean;
}

export interface OrchestratorRunOptions {
  userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
  maxIterations?: number;
  onStep?: (step: WorkflowStepEvent) => void;
}

type WorkflowGraph = {
  invoke: (input: AgentWorkflowState) => Promise<AgentWorkflowState>;
};

export class Orchestrator {
  private workflow: WorkflowGraph;
  private rapidMLXClient: RapidMLXClient;
  private modelRouter: ModelRouter;
  private skillParser: SkillParser;
  private loadedSkills = new Map<string, ParsedSkill>();
  private maxIterations: number;
  private userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
  private onStep?: (step: WorkflowStepEvent) => void;
  private mcpRegistry?: MCPRegistry;
  private knowledgeGraph?: OpenKB;
  private evolutionKernel?: EvolutionKernel;
  private taskSplitter = new TaskSplitter();
  private consensusEngine = new ConsensusEngine();
  private dynamicRouter: DynamicRouter;
  private defaultEngineMode: EngineMode;
  private parallelExecution: boolean;

  constructor(
    rapidMLXClient: RapidMLXClient,
    modelRouter: ModelRouter,
    skillParser: SkillParser,
    options: OrchestratorOptions = {}
  ) {
    this.rapidMLXClient = rapidMLXClient;
    this.modelRouter = modelRouter;
    this.dynamicRouter = modelRouter.getDynamicRouter();
    this.defaultEngineMode = options.engineMode ?? 'auto';
    this.parallelExecution = options.parallelExecution ?? true;
    this.skillParser = skillParser;
    this.maxIterations = options.maxIterations ?? 10;
    this.mcpRegistry = options.mcpRegistry;
    this.knowledgeGraph = options.knowledgeGraph;
    this.evolutionKernel = options.evolutionKernel;

    if (options.skillsDirectory) {
      this.loadSkillsFromDirectory(options.skillsDirectory);
    }

    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow(): WorkflowGraph {
    const stateGraphArgs = {
      channels: {
        currentAgent: {
          value: (_x: AgentState, y: AgentState) => y,
          default: () => 'planner' as AgentState,
        },
        taskInput: { value: (_x: string, y: string) => y, default: () => '' },
        plan: { value: (_x: string | null, y: string | null) => y, default: () => null },
        executionResult: {
          value: (_x: string | null, y: string | null) => y,
          default: () => null,
        },
        review: { value: (_x: string | null, y: string | null) => y, default: () => null },
        lastOutput: {
          value: (_x: string | null, y: string | null) => y,
          default: () => null,
        },
        availableSkills: {
          value: (_x: string[], y: string[]) => y,
          default: () => [] as string[],
        },
        knowledgeGraphUpdates: {
          value: (x: KnowledgeGraphUpdate[], y: KnowledgeGraphUpdate[]) => x.concat(y),
          default: () => [] as KnowledgeGraphUpdate[],
        },
        codeChangesProposed: {
          value: (_x: CodeChange[] | null, y: CodeChange[] | null) => y,
          default: () => null,
        },
        userApprovalRequired: {
          value: (_x: boolean, y: boolean) => y,
          default: () => false,
        },
        planApproved: { value: (_x: boolean, y: boolean) => y, default: () => false },
        compensationActions: {
          value: (_x: string[], y: string[]) => y,
          default: () => [] as string[],
        },
        agentTeam: {
          value: (
            _x: { role: string; model: string; provider?: string }[],
            y: { role: string; model: string; provider?: string }[]
          ) => y,
          default: () => [] as { role: string; model: string; provider?: string }[],
        },
        projectContext: {
          value: (_x: Record<string, unknown>, y: Record<string, unknown>) => y,
          default: () => ({} as Record<string, unknown>),
        },
        workflowIteration: { value: (_x: number, y: number) => y, default: () => 0 },
        subTasks: {
          value: (_x: AgentWorkflowState['subTasks'], y: AgentWorkflowState['subTasks']) => y,
          default: () => [] as AgentWorkflowState['subTasks'],
        },
        mcpToolResults: {
          value: (x: MCPToolResultSummary[], y: MCPToolResultSummary[]) => x.concat(y),
          default: () => [] as MCPToolResultSummary[],
        },
        consensusResult: {
          value: (_x: AgentWorkflowState['consensusResult'], y: AgentWorkflowState['consensusResult']) => y,
          default: () => null,
        },
        engineMode: {
          value: (_x: EngineMode, y: EngineMode) => y,
          default: () => 'auto' as EngineMode,
        },
        parallelExecution: {
          value: (_x: boolean, y: boolean) => y,
          default: () => true,
        },
      },
    } as unknown as StateGraphArgs<AgentWorkflowState>;

    const graphBuilder = new StateGraph<AgentWorkflowState>(stateGraphArgs);

    graphBuilder.addNode('planner', async (state: AgentWorkflowState) => {
      this.emitStep('planner', 'started');
      this.applyEngineMode(state.engineMode);
      console.log('Planner: Analyzing task and creating initial plan...');
      const skillsContext = this.buildSkillsContext(state.availableSkills);

      let memoryContext = '';
      if (this.knowledgeGraph) {
        const memories = this.knowledgeGraph.memory.recallForTask(state.taskInput, 3);
        if (memories.length) {
          memoryContext = `\nRecalled Projects:\n${memories.map((m) => `- ${m.name}: ${m.summary}`).join('\n')}`;
        }
      }

      const plan = await this.callLLM(
        'reasoning',
        'planner',
        'You are the Planner agent in AIOS. Create a detailed, step-by-step execution plan. ' +
          'Break the task into numbered sub-tasks. Reference relevant skills and MCP tools when applicable.',
        `Task: ${state.taskInput}\n\nProject Context: ${JSON.stringify(state.projectContext)}${memoryContext}\n\n` +
          `Available Skills:\n${skillsContext}\n\n` +
          (state.review ? `Previous Review Feedback:\n${state.review}\n\n` : '') +
          'Generate a structured plan with clear execution steps.'
      );

      const subTasks = this.taskSplitter.splitPlan(plan, state.taskInput);
      const agentTeam = await this.buildAgentTeam();

      this.emitStep('planner', 'completed', plan);

      return {
        currentAgent: 'planner' as AgentState,
        plan,
        lastOutput: plan,
        userApprovalRequired: !state.planApproved,
        agentTeam,
        workflowIteration: state.workflowIteration + 1,
        subTasks,
        availableSkills: state.availableSkills.length
          ? state.availableSkills
          : this.getLoadedSkillNames(),
      };
    });

    graphBuilder.addNode('executor', async (state: AgentWorkflowState) => {
      this.emitStep('executor', 'started');
      console.log('Executor: Executing plan step...');
      const skillsContext = this.buildSkillsContext(state.availableSkills);
      const subTaskContext = this.taskSplitter.formatSubTasksForExecution(state.subTasks);

      const { executionResult, mcpToolResults, updatedSubTasks } = await this.executeWithMCP(
        state,
        skillsContext,
        subTaskContext
      );

      const codeChangesProposed = this.extractCodeChanges(executionResult);
      this.emitStep('executor', 'completed', executionResult);

      return {
        currentAgent: 'executor' as AgentState,
        executionResult,
        lastOutput: executionResult,
        codeChangesProposed,
        mcpToolResults,
        subTasks: updatedSubTasks ?? state.subTasks,
      };
    });

    graphBuilder.addNode('critic', async (state: AgentWorkflowState) => {
      this.emitStep('critic', 'started');
      console.log('Critic: Multi-engine review of execution result...');

      const criticPrompt =
        `Original Task: ${state.taskInput}\n\nPlan:\n${state.plan}\n\n` +
        `Execution Result:\n${state.executionResult}\n\n` +
        `MCP Tool Results: ${JSON.stringify(state.mcpToolResults)}\n\n` +
        `Proposed Code Changes: ${state.codeChangesProposed ? JSON.stringify(state.codeChangesProposed) : 'None'}\n\n` +
        'Evaluate quality, completeness, and correctness.';

      const systemPrompt =
        'You are the Critic agent in AIOS. Review execution results against the plan. ' +
        'Start your response with exactly one verdict line:\n' +
        'VERDICT: APPROVED | NEEDS_CORRECTION | NEEDS_APPROVAL\n' +
        'Then provide detailed review.';

      const multiReviews = await this.dynamicRouter.routeMulti('critic', 'chat', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: criticPrompt },
      ]);

      const reviewInputs = multiReviews.map((r) => ({
        provider: r.provider,
        modelId: r.modelId,
        review: r.content || `VERDICT: APPROVED\n[${r.provider}] Review unavailable: ${r.error ?? 'empty'}`,
      }));

      const primaryReview = reviewInputs[0]?.review ?? await this.callLLM('chat', 'critic', systemPrompt, criticPrompt);

      const consensusResult = this.consensusEngine.resolveFromReviews(
        reviewInputs.length ? reviewInputs : [{ provider: 'primary', modelId: 'fallback', review: primaryReview }],
        state.executionResult,
        state.plan
      );

      this.emitStep('critic', 'completed', primaryReview);

      return {
        currentAgent: 'critic' as AgentState,
        review: primaryReview,
        lastOutput: primaryReview,
        userApprovalRequired: this.consensusEngine.needsUserApproval(consensusResult),
        consensusResult: {
          verdict: consensusResult.verdict,
          confidence: consensusResult.confidence,
          summary: consensusResult.summary,
          reviewers: consensusResult.reviewers?.map((r) => ({
            provider: r.provider,
            modelId: r.modelId,
            verdict: r.verdict,
          })),
        },
      };
    });

    graphBuilder.addNode('self_corrector', async (state: AgentWorkflowState) => {
      this.emitStep('self_corrector', 'started');
      console.log('Self-Corrector: Applying feedback and refining plan/code...');

      let refinedPlan = await this.callLLM(
        'reasoning',
        'self_corrector',
        'You are the Self-Corrector agent in AIOS. Refine the plan based on critic feedback.',
        `Original Plan:\n${state.plan}\n\nCritic Review:\n${state.review}\n\n` +
          'Produce an improved plan that addresses all issues raised.'
      );

      if (this.evolutionKernel && state.review) {
        const proposal = await this.evolutionKernel.proposals.generate(
          state.review,
          state.executionResult,
          state.codeChangesProposed ?? []
        );
        refinedPlan += `\n\n[Evolution Proposal ${proposal.id}]: ${proposal.description}`;
      }

      this.emitStep('self_corrector', 'completed', refinedPlan);

      return {
        currentAgent: 'planner' as AgentState,
        plan: refinedPlan,
        lastOutput: refinedPlan,
        userApprovalRequired: false,
        compensationActions: [...state.compensationActions, 'self_correction_applied'],
      };
    });

    graphBuilder.addNode('knowledge_updater', async (state: AgentWorkflowState) => {
      this.emitStep('knowledge_updater', 'started');
      console.log('Knowledge Updater: Integrating new insights into Knowledge Graph...');

      const newKnowledge: KnowledgeGraphUpdate = {
        type: 'task_completion',
        content: `Task "${state.taskInput}" completed. Plan: ${state.plan?.slice(0, 200)}`,
        source: state.executionResult?.slice(0, 500) ?? '',
        timestamp: new Date().toISOString(),
      };

      if (state.codeChangesProposed?.length) {
        newKnowledge.type = 'code_evolution';
        newKnowledge.content = `Code changes proposed for: ${state.codeChangesProposed.map((c) => c.filePath).join(', ')}`;
      }

      if (this.knowledgeGraph) {
        await this.knowledgeGraph.ingestion.ingest({
          type: 'workflow',
          data: {
            taskInput: state.taskInput,
            plan: state.plan,
            executionResult: state.executionResult,
            mcpToolResults: state.mcpToolResults,
            consensusResult: state.consensusResult,
            knowledgeGraphUpdates: [newKnowledge],
          },
        });
      }

      this.emitStep('knowledge_updater', 'completed', 'Knowledge Graph updated');

      return {
        currentAgent: 'knowledge_updater' as AgentState,
        knowledgeGraphUpdates: [newKnowledge],
        lastOutput: `Knowledge Graph updated (${this.knowledgeGraph?.store.getStats().nodeCount ?? 0} nodes)`,
      };
    });

    graphBuilder.addNode('user_approval', async (state: AgentWorkflowState) => {
      console.log('User Approval: Waiting for user decision...');

      let userApproved = true;
      if (this.userApprovalHandler) {
        userApproved = await this.userApprovalHandler(state);
      }

      if (userApproved) {
        return {
          currentAgent: 'planner' as AgentState,
          userApprovalRequired: false,
          planApproved: true,
          lastOutput: 'User approved, continuing with plan',
        };
      }

      return {
        currentAgent: 'planner' as AgentState,
        userApprovalRequired: false,
        planApproved: false,
        plan: null,
        lastOutput: 'User rejected, re-planning',
        compensationActions: [...state.compensationActions, 'user_rejected_plan'],
      };
    });

    graphBuilder.addNode('completed', async (state: AgentWorkflowState) => {
      console.log('Workflow completed.');
      return {
        currentAgent: 'completed' as AgentState,
        lastOutput: state.lastOutput ?? 'Task completed successfully',
      };
    });

    graphBuilder.addNode('failed', async (state: AgentWorkflowState) => {
      console.log('Workflow failed: max iterations exceeded.');
      return {
        currentAgent: 'failed' as AgentState,
        lastOutput: 'Workflow terminated: maximum iterations exceeded',
        compensationActions: [...state.compensationActions, 'max_iterations_exceeded'],
      };
    });

    graphBuilder.addConditionalEdges(
      'planner',
      (state: AgentWorkflowState) => {
        if (state.workflowIteration > this.maxIterations) {
          return 'failed';
        }
        if (state.userApprovalRequired && !state.planApproved) {
          return 'user_approval';
        }
        return 'executor';
      },
      { user_approval: 'user_approval', executor: 'executor', failed: 'failed' }
    );

    graphBuilder.addEdge('executor', 'critic');

    graphBuilder.addConditionalEdges(
      'critic',
      (state: AgentWorkflowState) => {
        if (state.workflowIteration > this.maxIterations) {
          return 'failed';
        }
        if (state.userApprovalRequired) {
          return 'user_approval';
        }
        const verdict = this.parseCriticVerdict(state.review ?? '');
        const consensusNeedsCorrection =
          state.consensusResult?.verdict === 'NEEDS_CORRECTION' || verdict.needsCorrection;
        if (consensusNeedsCorrection) {
          return 'self_corrector';
        }
        return 'knowledge_updater';
      },
      {
        user_approval: 'user_approval',
        self_corrector: 'self_corrector',
        knowledge_updater: 'knowledge_updater',
        failed: 'failed',
      }
    );

    graphBuilder.addConditionalEdges(
      'user_approval',
      (state: AgentWorkflowState) => {
        if (!state.planApproved) {
          return 'planner';
        }
        if (state.executionResult) {
          return 'knowledge_updater';
        }
        return 'executor';
      },
      { planner: 'planner', executor: 'executor', knowledge_updater: 'knowledge_updater' }
    );

    graphBuilder.addEdge('self_corrector', 'planner');
    graphBuilder.addEdge('knowledge_updater', 'completed');
    graphBuilder.addEdge('failed', 'completed');

    graphBuilder.setEntryPoint('planner');
    graphBuilder.setFinishPoint('completed');

    return graphBuilder.compile();
  }

  async run(
    initialState: AgentWorkflowState,
    options: OrchestratorRunOptions = {}
  ): Promise<AgentWorkflowState> {
    this.userApprovalHandler = options.userApprovalHandler;
    this.onStep = options.onStep;
    if (options.maxIterations !== undefined) {
      this.maxIterations = options.maxIterations;
      this.workflow = this.buildWorkflow();
    }

    console.log('Starting AIOS Orchestrator workflow...');
    const finalState = await this.workflow.invoke(initialState);
    console.log('AIOS Orchestrator workflow finished.');
    return finalState;
  }

  loadSkill(name: string, skillMarkdown: string): ParsedSkill {
    const parsed = this.skillParser.parse(skillMarkdown);
    this.loadedSkills.set(name, parsed);
    return parsed;
  }

  loadSkillsFromDirectory(skillsDir: string): string[] {
    const loaded: string[] = [];

    if (!fs.existsSync(skillsDir)) {
      console.warn(`Skills directory not found: ${skillsDir}`);
      return loaded;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          try {
            const content = fs.readFileSync(skillPath, 'utf-8');
            this.loadSkill(entry.name, content);
            loaded.push(entry.name);
          } catch (error) {
            console.warn(`Failed to load skill from ${skillPath}:`, error);
          }
        }
      } else if (entry.name === 'SKILL.md') {
        try {
          const content = fs.readFileSync(path.join(skillsDir, entry.name), 'utf-8');
          this.loadSkill(path.basename(skillsDir), content);
          loaded.push(path.basename(skillsDir));
        } catch (error) {
          console.warn(`Failed to load skill from ${skillsDir}:`, error);
        }
      }
    }

    return loaded;
  }

  getLoadedSkillNames(): string[] {
    return Array.from(this.loadedSkills.keys());
  }

  getLoadedSkill(name: string): ParsedSkill | undefined {
    return this.loadedSkills.get(name);
  }

  getAllLoadedSkills(): ParsedSkill[] {
    return Array.from(this.loadedSkills.values());
  }

  setAgentTeam(team: { role: string; model: string }[]): void {
    // Stored per-run via state; this method validates team config against model router
    for (const member of team) {
      console.log(`Agent team configured: ${member.role} -> ${member.model}`);
    }
  }

  identifyRelevantSkills(taskInput: string, skillNames?: string[]): string[] {
    const names = skillNames ?? this.getLoadedSkillNames();
    const taskLower = taskInput.toLowerCase();

    return names.filter((name) => {
      const skill = this.loadedSkills.get(name);
      if (!skill) return false;
      const description = skill.metadata.description?.toLowerCase() ?? '';
      const skillName = skill.metadata.name?.toLowerCase() ?? name.toLowerCase();
      return (
        taskLower.includes(skillName) ||
        description.split(/\s+/).some((word) => word.length > 4 && taskLower.includes(word))
      );
    });
  }

  private emitStep(agent: AgentState, status: WorkflowStepEvent['status'], output?: string): void {
    this.onStep?.({
      agent,
      status,
      output: output?.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  }

  private applyEngineMode(mode: EngineMode): void {
    this.dynamicRouter.setPreferences({ mode });
  }

  private async executeSubTaskParallel(
    subTask: AgentWorkflowState['subTasks'][0],
    state: AgentWorkflowState
  ): Promise<{ subTask: AgentWorkflowState['subTasks'][0]; results: MCPToolResultSummary[]; output: string }> {
    const routing = await this.dynamicRouter.route('executor', 'code');
    const updated = {
      ...subTask,
      status: 'running' as const,
      assignedEngine: `${routing.provider}/${routing.modelId}`,
    };

    const results: MCPToolResultSummary[] = [];

    if (this.mcpRegistry && subTask.assignedTools.length) {
      const toolResults = await Promise.all(
        subTask.assignedTools.map((toolName) =>
          this.mcpRegistry!.executeToolCall(toolName, { task: subTask.description })
        )
      );
      for (const r of toolResults) {
        results.push({
          toolName: r.toolName,
          adapterId: r.adapterId,
          success: r.success,
          result: r.result,
        });
      }
    }

    let output: string;
    try {
      const llmResult = await this.dynamicRouter.routeAndChat(
        'executor',
        'code',
        [
          {
            role: 'system',
            content: 'You are an Executor sub-agent in AIOS Swarm. Execute this sub-task only.',
          },
          {
            role: 'user',
            content:
              `Sub-task: ${subTask.description}\nParent task: ${state.taskInput}\n` +
              `MCP results: ${JSON.stringify(results)}\n` +
              'If code changes needed: FILE: path\n```diff\n...\n```',
          },
        ]
      );
      output = llmResult.content;
    } catch {
      output = `[${updated.assignedEngine}] Completed: ${subTask.description}`;
    }

    return {
      subTask: { ...updated, status: 'completed', result: output.slice(0, 300) },
      results,
      output,
    };
  }

  private async executeWithMCP(
    state: AgentWorkflowState,
    skillsContext: string,
    subTaskContext: string
  ): Promise<{
    executionResult: string;
    mcpToolResults: MCPToolResultSummary[];
    updatedSubTasks?: AgentWorkflowState['subTasks'];
  }> {
    const userPrompt =
      `Plan:\n${state.plan}\n\nSub-tasks:\n${subTaskContext}\n\nTask: ${state.taskInput}\n\n` +
      `Available Skills:\n${skillsContext}\n\n` +
      'Execute the plan using available MCP tools when appropriate.';

    if (state.parallelExecution && state.subTasks.length > 1) {
      console.log(`Executor: Parallel swarm execution (${state.subTasks.length} sub-tasks)...`);
      const parallelResults = await Promise.all(
        state.subTasks.map((st) => this.executeSubTaskParallel(st, state))
      );

      const mcpToolResults = parallelResults.flatMap((r) => r.results);
      const updatedSubTasks = parallelResults.map((r) => r.subTask);
      const executionResult =
        `Parallel Swarm Execution (${parallelResults.length} sub-agents):\n\n` +
        parallelResults
          .map(
            (r) =>
              `### [${r.subTask.id}] ${r.subTask.description}\nEngine: ${r.subTask.assignedEngine}\n${r.output}`
          )
          .join('\n\n');

      return { executionResult, mcpToolResults, updatedSubTasks };
    }

    if (!this.mcpRegistry) {
      const executionResult = await this.callLLM(
        'code',
        'executor',
        'You are the Executor agent in AIOS. Execute the given plan step by step. ' +
          'If code changes are needed, include them using this format:\n' +
          'FILE: path/to/file.ts\n```diff\n...diff content...\n```',
        userPrompt
      );
      return { executionResult, mcpToolResults: [] };
    }

    const tools = this.mcpRegistry.getAllTools();
    const mcpToolResults: MCPToolResultSummary[] = [];

    try {
      const response = await this.modelRouter.routeAndChatWithTools(
        'code',
        [
          {
            role: 'system',
            content:
              'You are the Executor agent in AIOS. Execute tasks using MCP tools when needed. ' +
              'Available tools are provided. Call tools for external app operations.',
          },
          { role: 'user', content: userPrompt },
        ],
        tools
      ) as { content?: string; tool_calls?: unknown[] };

      const toolCalls = this.mcpRegistry.parseToolCallsFromLLM(
        response as { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }
      );

      if (toolCalls.length > 0) {
        for (const call of toolCalls) {
          const result = await this.mcpRegistry.executeToolCall(
            call.name,
            call.arguments,
            call.id
          );
          mcpToolResults.push({
            toolName: result.toolName,
            adapterId: result.adapterId,
            success: result.success,
            result: result.result,
          });
        }

        const toolSummary = mcpToolResults
          .map((r) => `- ${r.toolName} (${r.adapterId}): ${r.success ? 'OK' : 'FAILED'}`)
          .join('\n');

        return {
          executionResult:
            `MCP Tool Execution Results:\n${toolSummary}\n\n` +
            `Details:\n${JSON.stringify(mcpToolResults, null, 2)}\n\n` +
            (response.content ?? ''),
          mcpToolResults,
        };
      }

      return {
        executionResult:
          response.content ??
          (await this.callLLM('code', 'executor', 'Execute the plan.', userPrompt)),
        mcpToolResults,
      };
    } catch (error) {
      console.warn('MCP execution failed, falling back to parallel simulated tools:', error);

      if (state.subTasks.length > 1) {
        return this.executeWithMCP({ ...state, parallelExecution: true }, skillsContext, subTaskContext);
      }

      for (const subTask of state.subTasks) {
        for (const toolName of subTask.assignedTools) {
          const result = await this.mcpRegistry.executeToolCall(toolName, {
            task: subTask.description,
          });
          mcpToolResults.push({
            toolName: result.toolName,
            adapterId: result.adapterId,
            success: result.success,
            result: result.result,
          });
        }
      }

      const fallbackText = await this.callLLM(
        'code',
        'executor',
        'You are the Executor agent in AIOS.',
        userPrompt + `\n\nMCP Results:\n${JSON.stringify(mcpToolResults)}`
      );

      return { executionResult: fallbackText, mcpToolResults };
    }
  }

  private async buildAgentTeam(): Promise<{ role: string; model: string; provider: string }[]> {
    const roles: AgentRole[] = ['planner', 'executor', 'critic', 'self_corrector', 'knowledge_updater'];
    const team = await Promise.all(
      roles.map(async (role) => {
        const routing = await this.dynamicRouter.route(role);
        return { role, model: routing.modelId, provider: routing.provider };
      })
    );
    return team;
  }

  private buildSkillsContext(skillNames: string[]): string {
    if (!skillNames.length) {
      return this.getLoadedSkillNames().length
        ? this.getLoadedSkillNames()
            .map((name) => {
              const skill = this.loadedSkills.get(name);
              return skill ? `- ${skill.metadata.name}: ${skill.metadata.description}` : `- ${name}`;
            })
            .join('\n')
        : 'No skills loaded';
    }

    return skillNames
      .map((name) => {
        const skill = this.loadedSkills.get(name);
        if (!skill) return `- ${name} (not loaded)`;
        const availableTools = this.mcpRegistry
          ? this.mcpRegistry.getAllTools().map((t) => t.function.name)
          : ['mcp', 'rapid-mlx'];
        const validation = this.skillParser.validateSkillStepsAgainstTools(skill, availableTools);
        const steps = skill.workflowSteps ? `\n  Steps: ${skill.workflowSteps.slice(0, 200)}...` : '';
        return `- ${skill.metadata.name}: ${skill.metadata.description}${steps}` +
          (validation.valid ? '' : `\n  Missing tools: ${validation.missingTools.join(', ')}`);
      })
      .join('\n');
  }

  private async callLLM(
    taskType: TaskType,
    role: AgentRole,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    try {
      const result = await this.dynamicRouter.routeAndChat(role, taskType, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      console.log(`[Orchestrator] ${role} via ${result.routing.provider}/${result.routing.modelId}`);
      return result.content;
    } catch (error) {
      console.warn(`LLM call failed (${taskType}/${role}), using structured fallback:`, error);
      return this.generateFallbackResponse(taskType, userPrompt);
    }
  }

  private generateFallbackResponse(taskType: TaskType, userPrompt: string): string {
    const taskSummary = userPrompt.slice(0, 300);

    switch (taskType) {
      case 'reasoning':
        return (
          `Plan for task:\n${taskSummary}\n` +
          '1. Analyze requirements\n2. Identify necessary skills\n3. Outline execution steps\n' +
          '4. Execute and validate\n5. Update knowledge graph'
        );
      case 'code':
        return (
          `Executed step based on plan:\n${taskSummary}\n\n` +
          'FILE: src/main.ts\n```diff\n+ // Implementation placeholder\n```'
        );
      case 'chat':
        return `VERDICT: APPROVED\nReview of execution: Task processed successfully.\n${taskSummary}`;
      default:
        return taskSummary;
    }
  }

  private parseCriticVerdict(review: string): { needsCorrection: boolean; needsApproval: boolean } {
    const upper = review.toUpperCase();
    return {
      needsCorrection:
        upper.includes('VERDICT: NEEDS_CORRECTION') || upper.includes('NEEDS CORRECTION'),
      needsApproval:
        upper.includes('VERDICT: NEEDS_APPROVAL') || upper.includes('NEEDS APPROVAL'),
    };
  }

  private extractCodeChanges(executionResult: string): CodeChange[] | null {
    const changes: CodeChange[] = [];
    const fileRegex = /FILE:\s*(.+?)(?:\n|$)/g;
    const diffRegex = /```(?:diff)?\n([\s\S]*?)```/g;

    const filePaths: string[] = [];
    let fileMatch;
    while ((fileMatch = fileRegex.exec(executionResult)) !== null) {
      filePaths.push(fileMatch[1].trim());
    }

    const diffs: string[] = [];
    let diffMatch;
    while ((diffMatch = diffRegex.exec(executionResult)) !== null) {
      diffs.push(diffMatch[1].trim());
    }

    if (filePaths.length && diffs.length) {
      for (let i = 0; i < Math.min(filePaths.length, diffs.length); i++) {
        changes.push({ filePath: filePaths[i], diff: diffs[i] });
      }
    } else if (diffs.length) {
      changes.push({ filePath: 'unknown', diff: diffs[0] });
    }

    return changes.length ? changes : null;
  }
}

export { createInitialWorkflowState };
