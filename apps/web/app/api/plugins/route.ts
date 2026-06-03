import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  const aios = getAIOS();
  return NextResponse.json({
    plugins: aios.plugins.getAllPlugins().map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
    })),
    tools: aios.plugins.getToolNames(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aios = getAIOS();

    if (body.action === 'load' && body.plugin) {
      await aios.plugins.load(body.plugin);
      return NextResponse.json({ loaded: body.plugin.id });
    }

    if (body.action === 'execute' && body.tool && body.args) {
      const result = await aios.plugins.executeTool(body.tool, body.args);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plugin operation failed' },
      { status: 500 }
    );
  }
}
