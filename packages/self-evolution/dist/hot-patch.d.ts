import { CodePatch } from './code-synthesis';
export type PatchStatus = 'pending' | 'validated' | 'approved' | 'applied' | 'rejected';
export interface UpdateProposal {
    id: string;
    patches: CodePatch[];
    status: PatchStatus;
    sandboxResult?: {
        success: boolean;
        output: string;
    };
    createdAt: string;
    appliedAt?: string;
    description: string;
}
export declare class HotPatchManager {
    private proposals;
    private synthesisEngine;
    private sandbox;
    private appliedPatches;
    createProposal(review: string, executionResult: string | null, existingChanges?: CodePatch[]): Promise<UpdateProposal>;
    approve(id: string): UpdateProposal | null;
    reject(id: string): UpdateProposal | null;
    apply(id: string): UpdateProposal | null;
    getProposal(id: string): UpdateProposal | undefined;
    getAllProposals(): UpdateProposal[];
    getPendingProposals(): UpdateProposal[];
    getAppliedPatches(): CodePatch[];
}
export declare class UpdateProposalGenerator {
    private hotPatchManager;
    constructor(hotPatchManager: HotPatchManager);
    generate(review: string, executionResult: string | null, codeChanges?: {
        filePath: string;
        diff: string;
    }[]): Promise<UpdateProposal>;
}
