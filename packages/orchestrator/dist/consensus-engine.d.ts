export type ConsensusVerdict = 'APPROVED' | 'NEEDS_CORRECTION' | 'NEEDS_APPROVAL';
export interface ConsensusResult {
    verdict: ConsensusVerdict;
    confidence: number;
    summary: string;
    dissenting?: string[];
}
export declare class ConsensusEngine {
    resolve(review: string, executionResult: string | null, plan: string | null): ConsensusResult;
    needsUserApproval(result: ConsensusResult): boolean;
    needsCorrection(result: ConsensusResult): boolean;
}
//# sourceMappingURL=consensus-engine.d.ts.map