import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  try {
    const aios = getAIOS();
    const policy = aios.evolution.policyStore.get();
    return NextResponse.json({
      policy,
      experienceSize: aios.evolution.experience.size(),
      successRate: aios.evolution.experience.getSuccessRate(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Training status failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataset, iterations = 10, action } = body;

    const aios = getAIOS();

    if (action === 'reset') {
      aios.evolution.policyStore.reset();
      return NextResponse.json({ reset: true, policy: aios.evolution.policyStore.get() });
    }

    const report = await aios.runTraining({ dataset, iterations });

    return NextResponse.json({
      completed: true,
      iterations: report.iterations.length,
      totalSamples: report.totalSamples,
      finalSuccessRate: report.finalSuccessRate,
      finalPolicy: report.finalPolicy,
      summary: report.iterations.map((r) => ({
        iteration: r.iteration,
        samples: r.samplesProcessed,
        successRate: r.successRate,
        improvements: r.improvementsApplied.length,
        retrain: r.retrainSamples,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Training failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
