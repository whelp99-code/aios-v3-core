"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovementApplier = void 0;
class ImprovementApplier {
    constructor(policyStore, hotPatch) {
        this.policyStore = policyStore;
        this.hotPatch = hotPatch;
    }
    apply(improvements, iteration) {
        const current = this.policyStore.get();
        const applied = [];
        const proposalIds = [];
        let policyUpdate = {
            iteration,
            appliedImprovements: [...current.appliedImprovements],
        };
        for (const imp of improvements) {
            switch (imp.type) {
                case 'quality':
                    if (imp.action.qualityThreshold !== undefined) {
                        policyUpdate.qualityThreshold = imp.action.qualityThreshold;
                        applied.push(imp.description);
                    }
                    break;
                case 'batch':
                    if (imp.action.batchSize !== undefined) {
                        policyUpdate.batchSize = imp.action.batchSize;
                        applied.push(imp.description);
                    }
                    break;
                case 'synthesis': {
                    const add = imp.action.addSynthesisKeywords;
                    if (add?.length) {
                        const merged = [...new Set([...current.synthesisKeywords, ...add])];
                        policyUpdate.synthesisKeywords = merged;
                        applied.push(imp.description);
                        if (this.hotPatch) {
                            const proposal = this.hotPatch.createDirectProposal(imp.description, [
                                {
                                    filePath: 'packages/self-evolution/src/code-synthesis.ts',
                                    diff: `+ // Learned keywords: ${add.join(', ')}`,
                                    description: imp.description,
                                },
                            ]);
                            proposalIds.push(proposal.id);
                            this.hotPatch.approve(proposal.id);
                            this.hotPatch.apply(proposal.id);
                        }
                    }
                    break;
                }
                case 'routing':
                    if (imp.action.routingBias) {
                        policyUpdate.routingBias = {
                            ...current.routingBias,
                            ...imp.action.routingBias,
                        };
                        applied.push(imp.description);
                    }
                    break;
                case 'category':
                    applied.push(imp.description);
                    break;
            }
            policyUpdate.appliedImprovements = [
                ...(policyUpdate.appliedImprovements ?? current.appliedImprovements),
                `[iter-${iteration}] ${imp.description}`,
            ];
        }
        const policy = this.policyStore.update({
            ...policyUpdate,
            iteration,
        });
        return { applied, policy, proposalIds };
    }
}
exports.ImprovementApplier = ImprovementApplier;
//# sourceMappingURL=improvement-applier.js.map