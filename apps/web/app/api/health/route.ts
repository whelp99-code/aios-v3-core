import { NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  try {
    const aios = getAIOS();
    const status = await aios.getEngineStatus();

    const localHealth = status.health.find((h) => h.provider === 'local');
    const cloudHealthy = status.health.some(
      (h) => h.provider !== 'local' && h.healthy
    );

    const overallStatus =
      localHealth?.healthy || cloudHealthy ? 'healthy' : 'degraded';

    return NextResponse.json({
      status: overallStatus,
      engine: 'hybrid',
      providers: status.health,
      resource: status.snapshot,
      preferences: status.preferences,
      models: status.models.filter((m) => m.status === 'active').slice(0, 10),
      rapidMLX: localHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'unhealthy',
        engine: 'hybrid',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
