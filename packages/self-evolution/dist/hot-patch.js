"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProposalGenerator = exports.HotPatchManager = void 0;
const code_synthesis_1 = require("./code-synthesis");
const sandbox_1 = require("./sandbox");
class HotPatchManager {
    constructor() {
        this.proposals = new Map();
        this.synthesisEngine = new code_synthesis_1.CodeSynthesisEngine();
        this.sandbox = new sandbox_1.SandboxExecutor();
        this.appliedPatches = [];
    }
    async createProposal(review, executionResult, existingChanges = []) {
        const synthesis = this.synthesisEngine.synthesize(review, executionResult, existingChanges);
        const id = `proposal-${Date.now()}`;
        const sandboxResults = [];
        for (const patch of synthesis.patches) {
            const result = await this.sandbox.executeCode(patch.diff);
            sandboxResults.push(result);
        }
        const testResult = await this.sandbox.runTests(synthesis.tests);
        const allPassed = sandboxResults.every((r) => r.success) && testResult.success;
        const proposal = {
            id,
            patches: synthesis.patches,
            status: allPassed ? 'validated' : 'pending',
            sandboxResult: {
                success: allPassed,
                output: sandboxResults.map((r) => r.output).join('\n') + '\n' + testResult.output,
            },
            createdAt: new Date().toISOString(),
            description: synthesis.reasoning,
        };
        this.proposals.set(id, proposal);
        return proposal;
    }
    /** Direct proposal from training loop improvements */
    createDirectProposal(description, patches) {
        const id = `proposal-${Date.now()}`;
        const proposal = {
            id,
            patches,
            status: 'validated',
            sandboxResult: { success: true, output: '[Training] Direct proposal validated' },
            createdAt: new Date().toISOString(),
            description,
        };
        this.proposals.set(id, proposal);
        return proposal;
    }
    approve(id) {
        const proposal = this.proposals.get(id);
        if (!proposal || proposal.status === 'rejected')
            return null;
        proposal.status = 'approved';
        return proposal;
    }
    reject(id) {
        const proposal = this.proposals.get(id);
        if (!proposal)
            return null;
        proposal.status = 'rejected';
        return proposal;
    }
    apply(id) {
        const proposal = this.proposals.get(id);
        if (!proposal || proposal.status !== 'approved')
            return null;
        proposal.status = 'applied';
        proposal.appliedAt = new Date().toISOString();
        this.appliedPatches.push(...proposal.patches);
        return proposal;
    }
    getProposal(id) {
        return this.proposals.get(id);
    }
    getAllProposals() {
        return Array.from(this.proposals.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    getPendingProposals() {
        return this.getAllProposals().filter((p) => p.status === 'pending' || p.status === 'validated');
    }
    getAppliedPatches() {
        return [...this.appliedPatches];
    }
}
exports.HotPatchManager = HotPatchManager;
class UpdateProposalGenerator {
    constructor(hotPatchManager) {
        this.hotPatchManager = hotPatchManager;
    }
    async generate(review, executionResult, codeChanges = []) {
        const patches = codeChanges.map((c) => ({
            filePath: c.filePath,
            diff: c.diff,
            description: `Proposed change to ${c.filePath}`,
        }));
        return this.hotPatchManager.createProposal(review, executionResult, patches);
    }
}
exports.UpdateProposalGenerator = UpdateProposalGenerator;
//# sourceMappingURL=hot-patch.js.map