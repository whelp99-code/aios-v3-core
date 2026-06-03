import { NextRequest, NextResponse } from 'next/server';
import { workflowSessionManager } from '@/lib/workflow-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskInput, autoApprove = true, engineMode, parallelExecution } = body;

    if (!taskInput || typeof taskInput !== 'string') {
      return NextResponse.json({ error: 'taskInput is required' }, { status: 400 });
    }

    const session = workflowSessionManager.start(taskInput.trim(), autoApprove, {
      engineMode,
      parallelExecution,
    });

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      taskInput: session.taskInput,
      createdAt: session.createdAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start workflow';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const session = workflowSessionManager.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    taskInput: session.taskInput,
    steps: session.steps,
    state: session.state
      ? {
          currentAgent: session.state.currentAgent,
          plan: session.state.plan,
          executionResult: session.state.executionResult,
          review: session.state.review,
          lastOutput: session.state.lastOutput,
          subTasks: session.state.subTasks,
          mcpToolResults: session.state.mcpToolResults,
          consensusResult: session.state.consensusResult,
          knowledgeGraphUpdates: session.state.knowledgeGraphUpdates,
          agentTeam: session.state.agentTeam,
          engineMode: session.state.engineMode,
        }
      : undefined,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
  });
}
