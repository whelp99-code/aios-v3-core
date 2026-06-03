export type ConsensusVerdict = 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL';

export interface ConsensusResult {
  verdict: ConsensusVerdict;
  confidence: number;
  summary: string;
  dissenting?: string[];
}

export class ConsensusEngine {
  resolve(review: string, executionResult: string | null, plan: string | null): ConsensusResult {
    const upper = review.toUpperCase();
    const dissenting: string[] = [];

    let verdict: ConsensusVerdict = 'APPROVED';
    if (upper.includes('VERDICT: NEEDS_CORRECTION') || upper.includes('NEEDS CORRECTION')) {
      verdict = 'NEEDS_CORRECTION';
    } else if (upper.includes('VERDICT: NEEDS_APPROVAL') || upper.includes('NEEDS APPROVAL')) {
      verdict = 'NEEDS_APPROVAL';
    }

    if (executionResult && plan) {
      const planSteps = (plan.match(/\d+[.)]/g) ?? []).length;
      const resultLength = executionResult.length;
      if (planSteps > 3 && resultLength < 100) {
        dissenting.push('Execution result may be too brief for the plan complexity');
        if (verdict === 'APPROVED') verdict = 'NEEDS_CORRECTION';
      }
    }

    const confidence = dissenting.length === 0 ? 0.9 : 0.6;

    return {
      verdict,
      confidence,
      summary: review.split('\n').slice(0, 3).join(' ').slice(0, 200),
      dissenting: dissenting.length ? dissenting : undefined,
    };
  }

  needsUserApproval(result: ConsensusResult): boolean {
    return result.verdict === 'NEEDS_APPROVAL';
  }

  needsCorrection(result: ConsensusResult): boolean {
    return result.verdict === 'NEEDS_CORRECTION';
  }
}
