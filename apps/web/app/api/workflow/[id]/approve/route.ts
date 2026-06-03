import { NextRequest, NextResponse } from 'next/server';
import { workflowSessionManager } from '@/lib/workflow-session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const approved = body.approved !== false;

    const success = workflowSessionManager.approve(id, approved);
    if (!success) {
      return NextResponse.json(
        { error: 'Session not found or not awaiting approval' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      sessionId: id,
      status: 'running',
      message: approved ? 'Plan approved, resuming workflow' : 'Plan rejected, re-planning',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process approval';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
