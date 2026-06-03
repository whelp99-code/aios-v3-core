export type ConsensusVerdict = 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL';
export interface ConsensusResult {
    verdict: ConsensusVerdict;
    confidence: number;
    summary: string;
    dissenting?: string[];
    reviewers?: Array<{
        provider: string;
        modelId: string;
        verdict: ConsensusVerdict;
    }>;
}
export interface ReviewInput {
    provider: string;
    modelId: string;
    review: string;
}
export declare class ConsensusEngine {
    resolve(review: string, executionResult: string | null, plan: string | null): ConsensusResult;
    resolveFromReviews(reviews: ReviewInput[], executionResult: string | null, plan: string | null): ConsensusResult;
    needsUserApproval(result: ConsensusResult): boolean;
    needsCorrection(result: ConsensusResult): boolean;
    private parseVerdict;
}
//# sourceMappingURL=consensus-engine.d.ts.map