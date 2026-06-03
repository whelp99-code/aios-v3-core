import { randomUUID } from 'crypto';
import { createInitialWorkflowState } from '@aios/orchestrator';
import { getOrchestrator } from './aios';

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
  subTasks?: { id: string; description: string; priority: number }[];
  mcpToolResults?: { toolName: string; adapterId: string; success: boolean; result?: unknown }[];
  consensusResult?: { verdict: string; confidence: number; summary: string };
  knowledgeGraphUpdates?: unknown[];
  agentTeam?: { role: string; model: string }[];
}

export interface WorkflowSession {
  id: string;
  taskInput: string;
  status: WorkflowSessionStatus;
  steps: WorkflowStepEvent[];
  state?: WorkflowStateSnapshot;
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
  start(taskInput: string, autoApprove = true): WorkflowSession {
    const id = randomUUID();
    const session: WorkflowSession = {
      id,
      taskInput,
      status: 'running',
      steps: [],
      createdAt: new Date().toISOString(),
    };

    sessions.set(id, session);
    this.runInBackground(session, autoApprove);
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

  private runInBackground(session: WorkflowSession, autoApprove: boolean): void {
    const orchestrator = getOrchestrator();

    orchestrator
      .run(createInitialWorkflowState(session.taskInput), {
        userApprovalHandler: async (state) => {
          if (autoApprove) return true;

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
        onStep: (step) => {
          session.steps.push(step);
        },
      })
      .then((finalState) => {
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
        };
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
