import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  try {
    const aios = getAIOS();
    const status = await aios.getEngineStatus();
    return NextResponse.json({
      preferences: status.preferences,
      providers: status.health,
      resource: status.snapshot,
      models: status.models.map((m) => ({
        modelId: m.modelId,
        provider: m.provider,
        displayName: m.displayName,
        capabilities: m.capabilities,
        costPerToken: m.costPerToken,
        securityLevel: m.securityLevel,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Engine status failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, preferredCloudProvider, securityLevel, roleOverrides } = body;

    const aios = getAIOS();
    aios.setEnginePreferences({
      ...(mode && { mode }),
      ...(preferredCloudProvider && { preferredCloudProvider }),
      ...(securityLevel && { securityLevel }),
      ...(roleOverrides && { roleOverrides }),
    });

    const status = await aios.getEngineStatus();
    return NextResponse.json({
      updated: true,
      preferences: status.preferences,
      resource: status.snapshot,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Engine update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
