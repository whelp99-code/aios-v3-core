import { randomUUID } from 'crypto';
import { getAIOS } from './aios';

export type WorkflowSessionStatus = 'running' | 'pending_approval' | 'completed' | 'failed';

export interface WorkflowStepEvent {
  agent: string;
  status: 'started' | 'completed';
  output?: string;
  timestamp: string;
}

export interface WorkflowStateSnapshot {
  currentAgent?: string;
  plan?: string | null;
  executionResult?: string | null;
  review?: string | null;
  lastOutput?: string | null;
  subTasks?: { id: string; description: string; priority: number; status?: string; assignedEngine?: string }[];
  mcpToolResults?: { toolName: string; adapterId: string; success: boolean; result?: unknown }[];
  consensusResult?: { verdict: string; confidence: number; summary: string; reviewers?: { provider: string; modelId: string; verdict: string }[] };
  knowledgeGraphUpdates?: unknown[];
  agentTeam?: { role: string; model: string; provider?: string }[];
  engineMode?: string;
}

export interface WorkflowSession {
  id: string;
  taskInput: string;
  status: WorkflowSessionStatus;
  steps: WorkflowStepEvent[];
  state?: WorkflowStateSnapshot;
  evolutionProposalId?: string;
  knowledgeNodes?: number;
  createdAt: string;
  completedAt?: string;
  approvalResolver?: (approved: boolean) => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __aiosWorkflowSessions: Map<string, WorkflowSession> | undefined;
}

const sessions: Map<string, WorkflowSession> =
  globalThis.__aiosWorkflowSessions ?? new Map<string, WorkflowSession>();
globalThis.__aiosWorkflowSessions = sessions;

export class WorkflowSessionManager {
  start(taskInput: string, autoApprove = true, options: { engineMode?: 'auto' | 'local' | 'cloud'; parallelExecution?: boolean } = {}): WorkflowSession {
    const id = randomUUID();
    const session: WorkflowSession = {
      id,
      taskInput,
      status: 'running',
      steps: [],
      createdAt: new Date().toISOString(),
    };

    sessions.set(id, session);
    this.runInBackground(session, autoApprove, options);
    return session;
  }

  get(id: string): WorkflowSession | undefined {
    return sessions.get(id);
  }

  approve(id: string, approved: boolean): boolean {
    const session = sessions.get(id);
    if (!session || session.status !== 'pending_approval' || !session.approvalResolver) {
      return false;
    }
    session.approvalResolver(approved);
    session.status = 'running';
    session.approvalResolver = undefined;
    return true;
  }

  private runInBackground(
    session: WorkflowSession,
    autoApprove: boolean,
    options: { engineMode?: 'auto' | 'local' | 'cloud'; parallelExecution?: boolean } = {}
  ): void {
    const aios = getAIOS();

    aios
      .run(session.taskInput, {
        autoApprove,
        engineMode: options.engineMode,
        parallelExecution: options.parallelExecution,
        onStep: (step) => session.steps.push(step),
        userApprovalHandler: autoApprove
          ? undefined
          : async (state) => {
              session.status = 'pending_approval';
              session.state = {
                currentAgent: state.currentAgent,
                plan: state.plan,
                executionResult: state.executionResult,
                review: state.review,
                lastOutput: state.lastOutput,
                subTasks: state.subTasks,
              };
              return new Promise<boolean>((resolve) => {
                session.approvalResolver = resolve;
              });
            },
      })
      .then((result) => {
        const finalState = result.state;
        session.state = {
          currentAgent: finalState.currentAgent,
          plan: finalState.plan,
          executionResult: finalState.executionResult,
          review: finalState.review,
          lastOutput: finalState.lastOutput,
          subTasks: finalState.subTasks,
          mcpToolResults: finalState.mcpToolResults,
          consensusResult: finalState.consensusResult ?? undefined,
          knowledgeGraphUpdates: finalState.knowledgeGraphUpdates,
          agentTeam: finalState.agentTeam,
          engineMode: finalState.engineMode,
        };
        session.evolutionProposalId = result.evolutionProposalId;
        session.knowledgeNodes = result.knowledgeNodes;
        session.completedAt = new Date().toISOString();
        session.status =
          finalState.currentAgent === 'completed'
            ? 'completed'
            : finalState.currentAgent === 'failed'
              ? 'failed'
              : 'completed';
      })
      .catch((error) => {
        console.error('Workflow failed:', error);
        session.status = 'failed';
        session.completedAt = new Date().toISOString();
      });
  }
}

export const workflowSessionManager = new WorkflowSessionManager();
