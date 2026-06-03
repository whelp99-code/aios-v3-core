import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  const aios = getAIOS();
  const snapshot = aios.knowledge.store.getSnapshot();
  const stats = aios.knowledge.store.getStats();
  const projects = aios.knowledge.memory.getAllProjects();
  const issues = aios.knowledge.validator.validate();

  return NextResponse.json({
    stats,
    nodes: snapshot.nodes.slice(-50),
    edges: snapshot.edges.slice(-50),
    projects,
    validationIssues: issues.length,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aios = getAIOS();

    if (body.action === 'query' && body.question) {
      const result = aios.queryKnowledge(body.question);
      return NextResponse.json(result);
    }

    if (body.action === 'validate') {
      const issues = aios.validateKnowledge();
      const fixed = aios.knowledge.validator.autoFix(issues);
      return NextResponse.json({ issues, autoFixed: fixed });
    }

    if (body.action === 'ingest' && body.source) {
      const nodes = await aios.knowledge.ingestion.ingest(body.source);
      return NextResponse.json({ ingested: nodes.length, nodes: nodes.map((n) => ({ id: n.id, label: n.label })) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Knowledge operation failed' },
      { status: 500 }
    );
  }
}
