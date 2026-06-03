import { LearnedPolicy, LearnedPolicyStore } from './learned-policy-store';
import { Improvement } from './improvement-analyzer';
import { HotPatchManager } from './hot-patch';
export interface ApplyResult {
    applied: string[];
    policy: LearnedPolicy;
    proposalIds: string[];
}
export declare class ImprovementApplier {
    private policyStore;
    private hotPatch?;
    constructor(policyStore: LearnedPolicyStore, hotPatch?: HotPatchManager | undefined);
    apply(improvements: Improvement[], iteration: number): ApplyResult;
}
