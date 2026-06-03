"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsensusEngine = void 0;
class ConsensusEngine {
    resolve(review, executionResult, plan) {
        return this.resolveFromReviews([{ provider: 'primary', modelId: 'default', review }], executionResult, plan);
    }
    resolveFromReviews(reviews, executionResult, plan) {
        const parsed = reviews
            .filter((r) => r.review.trim())
            .map((r) => ({
            ...r,
            verdict: this.parseVerdict(r.review),
        }));
        const dissenting = [];
        const reviewerSummaries = parsed.map((r) => ({
            provider: r.provider,
            modelId: r.modelId,
            verdict: r.verdict,
        }));
        const verdictCounts = {
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
        let verdict = 'APPROVED';
        if (verdictCounts.NEEDS_CORRECTION > 0) {
            verdict = 'NEEDS_CORRECTION';
        }
        else if (verdictCounts.NEEDS_APPROVAL > verdictCounts.APPROVED) {
            verdict = 'NEEDS_APPROVAL';
        }
        else if (verdictCounts.NEEDS_APPROVAL > 0 && verdictCounts.APPROVED === 0) {
            verdict = 'NEEDS_APPROVAL';
        }
        if (executionResult && plan) {
            const planSteps = (plan.match(/\d+[.)]/g) ?? []).length;
            const resultLength = executionResult.length;
            if (planSteps > 3 && resultLength < 100) {
                dissenting.push('Execution result may be too brief for the plan complexity');
                if (verdict === 'APPROVED')
                    verdict = 'NEEDS_CORRECTION';
            }
        }
        const total = parsed.length || 1;
        const agreeRatio = verdictCounts[verdict] / total;
        const confidence = dissenting.length === 0 ? 0.9 : Math.max(0.5, agreeRatio * 0.85);
        const summary = parsed.length > 1
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
    needsUserApproval(result) {
        return result.verdict === 'NEEDS_APPROVAL';
    }
    needsCorrection(result) {
        return result.verdict === 'NEEDS_CORRECTION';
    }
    parseVerdict(review) {
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
exports.ConsensusEngine = ConsensusEngine;
