import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  const aios = getAIOS();
  const proposals = aios.evolution.hotPatch.getAllProposals();
  const stats = {
    experienceSize: aios.evolution.experience.size(),
    successRate: aios.evolution.experience.getSuccessRate(),
    appliedPatches: aios.evolution.hotPatch.getAppliedPatches().length,
  };

  return NextResponse.json({ proposals, stats });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aios = getAIOS();
    const { proposalId, action } = body;

    if (!proposalId || !action) {
      return NextResponse.json({ error: 'proposalId and action required' }, { status: 400 });
    }

    let proposal;
    switch (action) {
      case 'approve':
        proposal = aios.evolution.hotPatch.approve(proposalId);
        break;
      case 'reject':
        proposal = aios.evolution.hotPatch.reject(proposalId);
        break;
      case 'apply':
        proposal = aios.evolution.hotPatch.apply(proposalId);
        if (proposal) {
          await aios.webhooks.publish('evolution.applied', { proposalId, patches: proposal.patches.length });
        }
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found or invalid state' }, { status: 400 });
    }

    return NextResponse.json({ proposal });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Evolution operation failed' },
      { status: 500 }
    );
  }
}
