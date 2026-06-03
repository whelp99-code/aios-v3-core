import { NextResponse } from 'next/server';
import { getMCPRegistry } from '@/lib/aios';

export async function GET() {
  try {
    const registry = getMCPRegistry();
    const adapters = await registry.healthCheckAll();

    return NextResponse.json({
      adapters,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to check MCP status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
