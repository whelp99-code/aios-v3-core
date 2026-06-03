export type ConsensusVerdict = 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL';

export interface ConsensusResult {
  verdict: ConsensusVerdict;
  confidence: number;
  summary: string;
  dissenting?: string[];
  reviewers?: Array<{ provider: string; modelId: string; verdict: ConsensusVerdict }>;
}

export interface ReviewInput {
  provider: string;
  modelId: string;
  review: string;
}

export class ConsensusEngine {
  resolve(review: string, executionResult: string | null, plan: string | null): ConsensusResult {
    return this.resolveFromReviews([{ provider: 'primary', modelId: 'default', review }], executionResult, plan);
  }

  resolveFromReviews(
    reviews: ReviewInput[],
    executionResult: string | null,
    plan: string | null
  ): ConsensusResult {
    const parsed = reviews
      .filter((r) => r.review.trim())
      .map((r) => ({
        ...r,
        verdict: this.parseVerdict(r.review),
      }));

    const dissenting: string[] = [];
    const reviewerSummaries: ConsensusResult['reviewers'] = parsed.map((r) => ({
      provider: r.provider,
      modelId: r.modelId,
      verdict: r.verdict,
    }));

    const verdictCounts: Record<ConsensusVerdict, number> = {
      APPROVED: 0,
      NEEDS_CORRECTION: 0,
      NEEDS_APPROVAL: 0,
    };

    for (const r of parsed) {
      verdictCounts[r.verdict]++;
      if (r.verdict !== 'APPROVED') {
        dissenting.push(`${r.provider}: ${r.verdict}`);
      }
    }

    let verdict: ConsensusVerdict = 'APPROVED';
    if (verdictCounts.NEEDS_CORRECTION > 0) {
      verdict = 'NEEDS_CORRECTION';
    } else if (verdictCounts.NEEDS_APPROVAL > verdictCounts.APPROVED) {
      verdict = 'NEEDS_APPROVAL';
    } else if (verdictCounts.NEEDS_APPROVAL > 0 && verdictCounts.APPROVED === 0) {
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

    const total = parsed.length || 1;
    const agreeRatio = verdictCounts[verdict] / total;
    const confidence = dissenting.length === 0 ? 0.9 : Math.max(0.5, agreeRatio * 0.85);

    const summary =
      parsed.length > 1
        ? `Multi-engine consensus (${parsed.length} reviewers): ${verdict}. ` +
          parsed
            .map((r) => `[${r.provider}] ${r.verdict}`)
            .join(', ')
        : parsed[0]?.review.split('\n').slice(0, 3).join(' ').slice(0, 200) ?? '';

    return {
      verdict,
      confidence,
      summary: summary.slice(0, 300),
      dissenting: dissenting.length ? dissenting : undefined,
      reviewers: reviewerSummaries.length ? reviewerSummaries : undefined,
    };
  }

  needsUserApproval(result: ConsensusResult): boolean {
    return result.verdict === 'NEEDS_APPROVAL';
  }

  needsCorrection(result: ConsensusResult): boolean {
    return result.verdict === 'NEEDS_CORRECTION';
  }

  private parseVerdict(review: string): ConsensusVerdict {
    const upper = review.toUpperCase();
    if (upper.includes('VERDICT: NEEDS_CORRECTION') || upper.includes('NEEDS CORRECTION')) {
      return 'NEEDS_CORRECTION';
    }
    if (upper.includes('VERDICT: NEEDS_APPROVAL') || upper.includes('NEEDS APPROVAL')) {
      return 'NEEDS_APPROVAL';
    }
    return 'APPROVED';
  }
}
